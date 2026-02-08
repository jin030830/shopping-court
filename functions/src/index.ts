import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";
import { 
  getTossApiConfig, 
  createMtlsAgent
} from "./toss";

// Firebase Admin 초기화
try {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
} catch (e) {
  console.error('Firebase Admin init failed');
}

// 인터페이스 정의
interface TossLoginRequest {
  authorizationCode: string;
  referrer?: string;
  developerId?: string;
}

interface TossTokenResponse {
  resultType: string;
  success?: {
    accessToken: string;
    tokenType: string;
    expiresIn: number;
    refreshToken: string;
    scope: string;
  };
  error?: {
    errorType: number;
    errorCode: string;
    reason: string;
  };
}

interface TossUserInfoResponse {
  resultType: string;
  success: {
    userKey: string | number;
    scope: string[];
    agreedTerms: string[];
    nameEncrypted?: string;
  };
  error?: {
    errorType: number;
    errorCode: string;
    reason: string;
  };
}

/**
 * 프로모션 리워드 지급 요청 (서버 중심 보상 트랜잭션 적용)
 * 클라이언트에서 호출: httpsCallable(functions, 'requestPromotionReward')({ promotionCode: '...' })
 */
export const requestPromotionReward = functions
  .region("asia-northeast3")
  .runWith({
    enforceAppCheck: false,
    timeoutSeconds: 60,
    memory: "512MB"
  })
  .https.onCall(async (data: { promotionCode: string; isWarmUp?: boolean }, context) => {
    // 0. Warm-up 요청 처리
    if (data.isWarmUp) {
      console.log(`[Warm-up] requestPromotionReward instance warmed up.`);
      return { success: true, message: "warmed up" };
    }

    // 1. 인증 확인
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "로그인이 필요합니다."
      );
    }

    // Lazy Loading: 필요한 모듈을 실제 로직 실행 시점에 임포트
    const { 
      getPromotionKey, 
      executePromotion 
    } = await import("./toss");

    const uid = context.auth.uid; // Firebase Auth UID
    const promotionCode = data.promotionCode;
    const GAVEL_REQUIRED = 50; // 차감할 판사봉
    const REWARD_AMOUNT = 5;   // 지급할 포인트 (원)
    // CallableContext에는 eventId가 없으므로 자체 생성
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (!promotionCode) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "promotionCode가 필요합니다."
      );
    }

    console.log(`[Promotion Start] RequestID: ${requestId}, User(UID): ${uid}, Code: ${promotionCode}`);

    // [중요] DB에서 실제 tossUserKey 가져오기
    // Firebase UID와 토스 userKey가 다를 수 있으므로 DB를 참조해야 함
    const userSnapshot = await admin.firestore().collection('users').doc(uid).get();
    if (!userSnapshot.exists) {
        throw new functions.https.HttpsError("not-found", "사용자 정보를 찾을 수 없습니다.");
    }
    
    const userData = userSnapshot.data();
    const tossUserKey = userData?.tossUserKey; // 토스 API 호출용 키

    if (!tossUserKey) {
        console.error(`[Promotion Error] RequestID: ${requestId}, Missing tossUserKey for user ${uid}`);
        throw new functions.https.HttpsError("failed-precondition", "토스 연동 정보(tossUserKey)가 없습니다.");
    }

    // 2. 가차감 (Firestore Transaction)
    try {
      await admin.firestore().runTransaction(async (transaction) => {
        const userRef = admin.firestore().collection('users').doc(uid);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists) {
          throw new functions.https.HttpsError("not-found", "사용자 정보를 찾을 수 없습니다.");
        }
        
        const currentData = userDoc.data();
        const currentPoints = currentData?.points || 0;

        if (currentPoints < GAVEL_REQUIRED) {
          throw new functions.https.HttpsError(
            "failed-precondition", 
            `판사봉이 부족합니다. (보유: ${currentPoints}, 필요: ${GAVEL_REQUIRED})`
          );
        }

        // 판사봉 차감 실행
        transaction.update(userRef, {
          points: admin.firestore.FieldValue.increment(-GAVEL_REQUIRED)
        });
      });
    } catch (dbError: any) {
      console.error(`[Promotion DB Error] RequestID: ${requestId}, User: ${uid}, Failed to deduct points:`, dbError);
      if (dbError instanceof functions.https.HttpsError) throw dbError;
      throw new functions.https.HttpsError("internal", "포인트 차감 중 오류가 발생했습니다.");
    }

    // 3. 토스 API 호출 (외부 연동)
    try {
      // 3-1. 키 발급 (tossUserKey 사용)
      const executionKey = await getPromotionKey(tossUserKey, promotionCode);

      // 3-2. 지급 실행 (tossUserKey, promotionCode, executionKey, amount 순서)
      const result = await executePromotion(
          tossUserKey, 
          promotionCode, 
          executionKey, 
          REWARD_AMOUNT
      );

      console.log(`[Promotion Success] RequestID: ${requestId}, User: ${uid}, Result:`, JSON.stringify(result));

      // 4. 성공 확정: 누적 교환 포인트 기록 업데이트
      await admin.firestore().collection('users').doc(uid).update({
        totalExchangedPoints: admin.firestore.FieldValue.increment(REWARD_AMOUNT),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        success: true,
        requestId,
        result
      };

    } catch (apiError: any) {
      // 5. 실패 시 롤백 (보상 트랜잭션)
      console.error(`[Promotion API Error] RequestID: ${requestId}, User: ${uid}, Error: ${apiError.message}`);
      
      try {
        console.warn(`[Promotion Rollback Executing] RequestID: ${requestId}, User: ${uid}, Restoring ${GAVEL_REQUIRED} points...`);
        await admin.firestore().collection('users').doc(uid).update({
          points: admin.firestore.FieldValue.increment(GAVEL_REQUIRED),
          lastErrorRequestId: requestId // 추후 상담을 위해 마지막 에러 요청 ID 기록
        });
        console.log(`[Promotion Rollback Success] RequestID: ${requestId}, User: ${uid}`);
      } catch (rollbackError) {
        console.error(`[CRITICAL ROLLBACK FAILURE] RequestID: ${requestId}, User: ${uid}:`, rollbackError);
      }

      if (apiError instanceof functions.https.HttpsError) throw apiError;
      throw new functions.https.HttpsError(
        "internal",
        apiError.message || "프로모션 지급 처리 중 오류가 발생했습니다."
      );
    }
  });

/**
 * 토스 API로 토큰 생성
 */
async function generateTossToken(authorizationCode: string, referrer: string | undefined): Promise<string> {
  const config = getTossApiConfig();
  const httpsAgent = createMtlsAgent();

  try {
    const response = await axios.post<TossTokenResponse>(
      `${config.authApiBase}/api-partner/v1/apps-in-toss/user/oauth2/generate-token`,
      {
        authorizationCode: authorizationCode,
        referrer: referrer || "",
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Client-Id": config.clientId,
        },
        httpsAgent,
      }
    );

    const accessToken = response.data.success?.accessToken;
    if (!accessToken) {
      throw new functions.https.HttpsError("internal", "Toss API did not return an accessToken.");
    }

    return accessToken;
  } catch (error) {
    console.error("토스 토큰 생성 실패");
    throw new functions.https.HttpsError("internal", "토스 토큰 생성에 실패했습니다.");
  }
}

/**
 * 토스 API로 사용자 정보 조회
 */
async function getTossUserInfo(accessToken: string): Promise<TossUserInfoResponse> {
  const config = getTossApiConfig();
  const httpsAgent = createMtlsAgent();

  try {
    const response = await axios.get<TossUserInfoResponse>(
      `${config.authApiBase}/api-partner/v1/apps-in-toss/user/oauth2/login-me`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        httpsAgent,
      }
    );
    
    if (response.data.resultType !== "SUCCESS" || !response.data.success) {
       throw new functions.https.HttpsError("internal", "사용자 정보를 불러올 수 없습니다.");
    }

    return response.data;
  } catch (error) {
    console.error("토스 사용자 정보 조회 실패");
    throw new functions.https.HttpsError("internal", "사용자 정보 조회 실패");
  }
}

/**
 * 토스 로그인 처리 및 Firebase 커스텀 토큰 생성
 */
export const tossLogin = functions
  .region("asia-northeast3")
  .runWith({
    enforceAppCheck: false,
    timeoutSeconds: 60,
    memory: "256MB"
  })
  .https.onCall(async (data: TossLoginRequest) => {
    try {
      const config = getTossApiConfig();

      // 테스트 모드일 때만 developerId를 통한 우회 로그인을 허용합니다.
      if (config.testMode && data.developerId) {
        const devUserKey = `dev-user-${data.developerId}`;
        const customToken = await admin.auth().createCustomToken(devUserKey);
        return { customToken, tossUserKey: devUserKey };
      }

      if (!data.authorizationCode) {
        throw new functions.https.HttpsError("invalid-argument", "authorizationCode가 필요합니다.");
      }

      if (config.testMode && !data.developerId) {
        const testUserKey = `test-user-${Date.now()}`;
        const customToken = await admin.auth().createCustomToken(testUserKey);
        return { customToken, tossUserKey: testUserKey };
      }

      const accessToken = await generateTossToken(data.authorizationCode, data.referrer);
      const userInfoResponse = await getTossUserInfo(accessToken);
      const userKey = String(userInfoResponse.success.userKey);
      const customToken = await admin.auth().createCustomToken(userKey);

      return {
        customToken,
        tossUserKey: userKey,
      };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError("internal", "로그인 처리 중 오류가 발생했습니다.");
    }
  });

/**
 * 토스 로그인 연결 끊기 (userKey로)
 */
export const tossLogout = functions
  .region("asia-northeast3")
  .runWith({
    enforceAppCheck: false,
    timeoutSeconds: 30,
    memory: "256MB"
  })
  .https.onCall(async (data: { userKey?: string }) => {
    try {
      if (!data.userKey) {
        throw new functions.https.HttpsError("invalid-argument", "userKey가 필요합니다.");
      }

      if (data.userKey.startsWith('dev-user-') || data.userKey.startsWith('test-user-')) {
        return { success: true };
      }

      const config = getTossApiConfig();
      const httpsAgent = createMtlsAgent();

      await axios.post(
        `${config.authApiBase}/api-partner/v1/apps-in-toss/user/oauth2/access/remove-by-user-key`,
        { userKey: data.userKey },
        {
          httpsAgent,
          headers: { "Content-Type": "application/json" },
        }
      );

      return { success: true };
    } catch (error: any) {
      console.warn("Toss logout failed");
      return { success: false };
    }
  });

/**
 * 토스 앱에서 서비스 연결 해제 콜백 처리
 * GET/POST 방식 모두 지원
 */
export const tossUnlinkCallback = functions
  .region("asia-northeast3")
  .runWith({
    enforceAppCheck: false,
    timeoutSeconds: 30,
    memory: "256MB"
  })
  .https.onRequest(async (req, res) => {
    // 상세 로그: 요청 정보 전체 기록
    console.log(`[Toss Unlink Callback] === Request Received ===`);
    console.log(`[Toss Unlink Callback] Method: ${req.method}`);
    console.log(`[Toss Unlink Callback] URL: ${req.url}`);
    console.log(`[Toss Unlink Callback] Headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`[Toss Unlink Callback] Query:`, JSON.stringify(req.query, null, 2));
    console.log(`[Toss Unlink Callback] Body:`, JSON.stringify(req.body, null, 2));

    try {
      // CORS 헤더 설정
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      // OPTIONS 요청 처리 (CORS preflight)
      if (req.method === 'OPTIONS') {
        console.log(`[Toss Unlink Callback] OPTIONS request - CORS preflight`);
        res.status(204).send('');
        return;
      }

      // Basic Auth 검증 (토스 콘솔에서 설정한 경우)
      // 참고: 토스 콘솔에서 Basic Auth를 설정하면 자동으로 헤더에 포함됩니다
      const callbackAuthUser = process.env.TOSS_CALLBACK_AUTH_USER || functions.config().toss?.callback_auth_user;
      const callbackAuthPass = process.env.TOSS_CALLBACK_AUTH_PASS || functions.config().toss?.callback_auth_pass;

      if (callbackAuthUser && callbackAuthPass) {
        console.log(`[Toss Unlink Callback] Basic Auth enabled`);
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Basic ')) {
          console.log(`[Toss Unlink Callback] Missing or invalid Authorization header`);
          res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' });
          return;
        }

        const credentials = Buffer.from(authHeader.substring(6), 'base64').toString('utf-8');
        const [username, password] = credentials.split(':');
        
        if (username !== callbackAuthUser || password !== callbackAuthPass) {
          console.log(`[Toss Unlink Callback] Invalid Basic Auth credentials`);
          res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
          return;
        }
        console.log(`[Toss Unlink Callback] Basic Auth verified`);
      } else {
        console.log(`[Toss Unlink Callback] Basic Auth not configured (skipping verification)`);
      }

      // GET 또는 POST 방식으로 userKey, referrer 추출
      // 문서 참고: https://developers-apps-in-toss.toss.im/login/develop.html
      let userKey: string | undefined;
      let referrer: string | undefined;

      if (req.method === 'GET') {
        // GET 방식: query parameter에서 추출
        userKey = req.query.userKey as string;
        referrer = req.query.referrer as string;
        console.log(`[Toss Unlink Callback] GET request - userKey: ${userKey}, referrer: ${referrer}`);
      } else if (req.method === 'POST') {
        // POST 방식: body에서 추출
        userKey = req.body?.userKey;
        referrer = req.body?.referrer;
        console.log(`[Toss Unlink Callback] POST request - userKey: ${userKey}, referrer: ${referrer}`);
      } else {
        console.log(`[Toss Unlink Callback] Unsupported method: ${req.method}`);
        res.status(405).json({ error: 'Method not allowed', message: `Method ${req.method} is not allowed. Use GET or POST.` });
        return;
      }

      if (!userKey) {
        console.log(`[Toss Unlink Callback] Missing userKey parameter`);
        res.status(400).json({ error: 'userKey is required' });
        return;
      }

      // referrer 값 확인 및 로깅
      // referrer 가능한 값: UNLINK, WITHDRAWAL_TERMS, WITHDRAWAL_TOSS
      console.log(`[Toss Unlink Callback] Processing unlink - userKey: ${userKey}, referrer: ${referrer || 'N/A'}`);
      
      if (referrer) {
        const validReferrers = ['UNLINK', 'WITHDRAWAL_TERMS', 'WITHDRAWAL_TOSS'];
        if (!validReferrers.includes(referrer)) {
          console.warn(`[Toss Unlink Callback] Unknown referrer value: ${referrer}`);
        }
      }

      // 테스트/개발 모드 사용자는 건너뛰기
      if (userKey.startsWith('dev-user-') || userKey.startsWith('test-user-')) {
        console.log(`[Toss Unlink Callback] Skipping test/dev user: ${userKey}`);
        res.status(200).json({ 
          success: true, 
          message: 'Test user skipped',
          userKey,
          referrer: referrer || 'N/A'
        });
        return;
      }

      // userKey로 Firebase 사용자 찾기 및 삭제
      try {
        console.log(`[Toss Unlink Callback] Attempting to delete Firebase Auth user: ${userKey}`);
        await admin.auth().deleteUser(userKey);
        console.log(`[Toss Unlink Callback] ✅ Firebase Auth user deleted successfully: ${userKey}`);
      } catch (authError: any) {
        if (authError.code === 'auth/user-not-found') {
          console.log(`[Toss Unlink Callback] ⚠️ Auth user already deleted or not found: ${userKey}`);
        } else {
          console.error(`[Toss Unlink Callback] ❌ Error deleting Auth user:`, authError);
        }
      }

      // Firestore에서 사용자 관련 모든 데이터 삭제 시작 (각 단계 독립 처리)
      const db = admin.firestore();
      const affectedCaseIds = new Set<string>();

      // 1. 사용자가 작성한 게시물(cases) 삭제
      try {
        const casesQuery = db.collection('cases').where('authorId', '==', userKey);
        const casesSnapshot = await casesQuery.get();
        console.log(`[Toss Unlink Callback] Found ${casesSnapshot.size} cases to delete`);
        for (const doc of casesSnapshot.docs) {
          await doc.ref.delete();
        }
      } catch (e) {
        console.error(`[Toss Unlink Callback] Error deleting cases:`, e);
      }

      // 2. 사용자가 남긴 모든 투표(votes) 삭제
      try {
        const votesQuery = db.collectionGroup('votes').where('userId', '==', userKey);
        const votesSnapshot = await votesQuery.get();
        console.log(`[Toss Unlink Callback] Found ${votesSnapshot.size} votes to delete`);
        for (const doc of votesSnapshot.docs) {
          const caseId = doc.ref.parent.parent?.id;
          if (caseId) affectedCaseIds.add(caseId);
          await doc.ref.delete();
        }
      } catch (e) {
        console.error(`[Toss Unlink Callback] Error deleting votes:`, e);
      }

      // 3. 사용자가 작성한 모든 댓글(comments) 삭제
      try {
        const commentsQuery = db.collectionGroup('comments').where('authorId', '==', userKey);
        const commentsSnapshot = await commentsQuery.get();
        console.log(`[Toss Unlink Callback] Found ${commentsSnapshot.size} comments to delete`);
        for (const doc of commentsSnapshot.docs) {
          const caseId = doc.ref.parent.parent?.id;
          if (caseId) affectedCaseIds.add(caseId);
          await doc.ref.delete();
        }
      } catch (e) {
        console.error(`[Toss Unlink Callback] Error deleting comments:`, e);
      }

      // 4. 사용자가 작성한 모든 답글(replies) 삭제
      try {
        const repliesQuery = db.collectionGroup('replies').where('authorId', '==', userKey);
        const repliesSnapshot = await repliesQuery.get();
        console.log(`[Toss Unlink Callback] Found ${repliesSnapshot.size} replies to delete`);
        for (const doc of repliesSnapshot.docs) {
          const caseId = doc.ref.parent.parent?.parent?.parent?.id;
          if (caseId) affectedCaseIds.add(caseId);
          await doc.ref.delete();
        }
      } catch (e) {
        console.error(`[Toss Unlink Callback] Error deleting replies:`, e);
      }

      // 5. 사용자가 누른 '좋아요' 제거 및 카운트 차감 (댓글)
      try {
        const likedCommentsQuery = db.collectionGroup('comments').where('likedBy', 'array-contains', userKey);
        const likedCommentsSnapshot = await likedCommentsQuery.get();
        for (const doc of likedCommentsSnapshot.docs) {
          const currentLikes = doc.data().likes || 0;
          await doc.ref.update({
            likedBy: admin.firestore.FieldValue.arrayRemove(userKey),
            likes: Math.max(0, currentLikes - 1)
          });
        }
      } catch (e) {
        console.error(`[Toss Unlink Callback] Error removing likes from comments:`, e);
      }

      // 6. 사용자가 누른 '좋아요' 제거 및 카운트 차감 (답글)
      try {
        const likedRepliesQuery = db.collectionGroup('replies').where('likedBy', 'array-contains', userKey);
        const likedRepliesSnapshot = await likedRepliesQuery.get();
        for (const doc of likedRepliesSnapshot.docs) {
          const currentLikes = doc.data().likes || 0;
          await doc.ref.update({
            likedBy: admin.firestore.FieldValue.arrayRemove(userKey),
            likes: Math.max(0, currentLikes - 1)
          });
        }
      } catch (e) {
        console.error(`[Toss Unlink Callback] Error removing likes from replies:`, e);
      }

      // 7. 영향을 받은 게시물들 수치 최종 동기화 및 0 미만 방지
      console.log(`[Toss Unlink Callback] Syncing ${affectedCaseIds.size} affected cases`);
      for (const caseId of affectedCaseIds) {
        try {
          const caseRef = db.collection('cases').doc(caseId);
          const caseDoc = await caseRef.get();
          if (caseDoc.exists) {
            const data = caseDoc.data();
            await caseRef.update({
              guiltyCount: Math.max(0, data?.guiltyCount || 0),
              innocentCount: Math.max(0, data?.innocentCount || 0),
              commentCount: Math.max(0, data?.commentCount || 0),
              hotScore: Math.max(0, data?.hotScore || 0)
            });
          }
        } catch (syncError) {
          console.error(`[Toss Unlink Callback] Error syncing case ${caseId}:`, syncError);
        }
      }

      // 8. 사용자 프로필 최종 삭제 (판사봉 등 모든 정보 삭제)
      try {
        await db.collection('users').doc(userKey).delete();
        console.log(`[Toss Unlink Callback] ✅ Firestore user profile deleted: ${userKey}`);
      } catch (firestoreError: any) {
        console.error(`[Toss Unlink Callback] ❌ Failed to delete users document:`, firestoreError);
      }

      // 성공 응답 (토스 재시도 방지를 위해 무조건 200 반환)
      console.log(`[Toss Unlink Callback] ✅ Cleanup process finished for ${userKey}`);
      res.status(200).json({ 
        success: true, 
        userKey,
        referrer: referrer || 'N/A',
        message: 'Cleanup process completed'
      });

    } catch (error: any) {
      console.error('[Toss Unlink Callback] ❌ Unexpected error:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      // 에러가 발생해도 200 응답 (토스에 성공으로 알림하여 재시도 방지)
      // 토스는 200 응답을 받으면 재시도하지 않습니다
      res.status(200).json({ 
        success: false, 
        error: 'Internal server error',
        message: error.message
      });
    }
  });

import { claimMissionReward } from './mission';

// ... (기존 코드 생략)

export { 
  onCaseCreate,
  onCaseDelete,
  onVoteCreate, 
  onCommentCreate, 
  onVoteDelete, 
  onCommentDelete,
  onReplyCreate,
  onReplyDelete
} from './triggers';

export { closeExpiredCases } from './scheduled';
export { claimMissionReward }; // 추가됨