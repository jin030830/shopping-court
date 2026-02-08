import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";
import { 
  getTossApiConfig, 
  createMtlsAgent
} from "./toss";
import { 
  syncCaseCounts 
} from "./triggers";

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
 * 프로모션 리워드 지급 요청
 */
export const requestPromotionReward = functions
  .region("asia-northeast3")
  .runWith({
    enforceAppCheck: false,
    timeoutSeconds: 60,
    memory: "512MB"
  })
  .https.onCall(async (data: { promotionCode: string; isWarmUp?: boolean }, context) => {
    if (data.isWarmUp) return { success: true };
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");

    const { getPromotionKey, executePromotion } = await import("./toss");
    const uid = context.auth.uid;
    const promotionCode = data.promotionCode;
    const GAVEL_REQUIRED = 50;
    const REWARD_AMOUNT = 5;
    const requestId = `req_${Date.now()}`;

    const userSnapshot = await admin.firestore().collection('users').doc(uid).get();
    if (!userSnapshot.exists) throw new functions.https.HttpsError("not-found", "사용자 정보를 찾을 수 없습니다.");
    
    const tossUserKey = userSnapshot.data()?.tossUserKey;
    if (!tossUserKey) throw new functions.https.HttpsError("failed-precondition", "토스 연동 정보가 없습니다.");

    try {
      await admin.firestore().runTransaction(async (transaction) => {
        const userRef = admin.firestore().collection('users').doc(uid);
        const userDoc = await transaction.get(userRef);
        const points = userDoc.data()?.points || 0;
        if (points < GAVEL_REQUIRED) throw new functions.https.HttpsError("failed-precondition", "판사봉이 부족합니다.");
        transaction.update(userRef, { points: admin.firestore.FieldValue.increment(-GAVEL_REQUIRED) });
      });

      const key = await getPromotionKey(tossUserKey, promotionCode);
      await executePromotion(tossUserKey, promotionCode, key, REWARD_AMOUNT);

      await admin.firestore().collection('users').doc(uid).update({
        totalExchangedPoints: admin.firestore.FieldValue.increment(REWARD_AMOUNT),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, requestId };
    } catch (apiError: any) {
      await admin.firestore().collection('users').doc(uid).update({ points: admin.firestore.FieldValue.increment(GAVEL_REQUIRED) });
      throw new functions.https.HttpsError("internal", apiError.message || "오류가 발생했습니다.");
    }
  });

/**
 * 토스 API로 토큰 생성
 */
async function generateTossToken(authorizationCode: string, referrer: string | undefined): Promise<string> {
  const config = getTossApiConfig();
  const httpsAgent = createMtlsAgent();
  const response = await axios.post<TossTokenResponse>(`${config.authApiBase}/api-partner/v1/apps-in-toss/user/oauth2/generate-token`, { authorizationCode, referrer: referrer || "" }, { headers: { "Content-Type": "application/json", "X-Client-Id": config.clientId }, httpsAgent });
  const accessToken = response.data.success?.accessToken;
  if (!accessToken) throw new functions.https.HttpsError("internal", "Token error");
  return accessToken;
}

/**
 * 토스 API로 사용자 정보 조회
 */
async function getTossUserInfo(accessToken: string): Promise<TossUserInfoResponse> {
  const config = getTossApiConfig();
  const httpsAgent = createMtlsAgent();
  const response = await axios.get<TossUserInfoResponse>(`${config.authApiBase}/api-partner/v1/apps-in-toss/user/oauth2/login-me`, { headers: { Authorization: `Bearer ${accessToken}` }, httpsAgent });
  if (response.data.resultType !== "SUCCESS") throw new functions.https.HttpsError("internal", "User info error");
  return response.data;
}

export const tossLogin = functions.region("asia-northeast3").https.onCall(async (data: TossLoginRequest) => {
  const config = getTossApiConfig();
  if (config.testMode && data.developerId) {
    const devKey = `dev-user-${data.developerId}`;
    return { customToken: await admin.auth().createCustomToken(devKey), tossUserKey: devKey };
  }
  const accessToken = await generateTossToken(data.authorizationCode, data.referrer);
  const userInfo = await getTossUserInfo(accessToken);
  const userKey = String(userInfo.success.userKey);
  return { customToken: await admin.auth().createCustomToken(userKey), tossUserKey: userKey };
});

export const tossLogout = functions.region("asia-northeast3").https.onCall(async (data: { userKey?: string }) => {
  if (!data.userKey) return { success: false };
  const config = getTossApiConfig();
  const httpsAgent = createMtlsAgent();
  try {
    await axios.post(`${config.authApiBase}/api-partner/v1/apps-in-toss/user/oauth2/access/remove-by-user-key`, { userKey: data.userKey }, { httpsAgent, headers: { "Content-Type": "application/json" } });
    return { success: true };
  } catch { return { success: false }; }
});

export const tossUnlinkCallback = functions.region("asia-northeast3").https.onRequest(async (req, res) => {
  try {
    const userKey = (req.method === 'GET' ? req.query.userKey : req.body?.userKey) as string;
    if (!userKey) {
      res.status(400).send('No userKey');
      return;
    }

    try { await admin.auth().deleteUser(userKey); } catch (e) {}

    const db = admin.firestore();
    const affectedCaseIds = new Set<string>();

    // 1. 게시물 삭제
    const cases = await db.collection('cases').where('authorId', '==', userKey).get();
    for (const d of cases.docs) await d.ref.delete();

    // 2. 투표 삭제 및 대상 수집
    const votes = await db.collectionGroup('votes').where('userId', '==', userKey).get();
    for (const d of votes.docs) {
      const cid = d.ref.parent.parent?.id;
      if (cid) affectedCaseIds.add(cid);
      await d.ref.delete();
    }

    // 3. 댓글 삭제 및 대상 수집
    const comments = await db.collectionGroup('comments').where('authorId', '==', userKey).get();
    for (const d of comments.docs) {
      const cid = d.ref.parent.parent?.id;
      if (cid) affectedCaseIds.add(cid);
      await d.ref.delete();
    }

    // 4. 답글 삭제 및 대상 수집
    const replies = await db.collectionGroup('replies').where('authorId', '==', userKey).get();
    for (const d of replies.docs) {
      const cid = d.ref.parent.parent?.parent?.parent?.id;
      if (cid) affectedCaseIds.add(cid);
      await d.ref.delete();
    }

    // 5. 좋아요 제거
    const likedC = await db.collectionGroup('comments').where('likedBy', 'array-contains', userKey).get();
    for (const d of likedC.docs) {
      await d.ref.update({ likedBy: admin.firestore.FieldValue.arrayRemove(userKey), likes: Math.max(0, (d.data().likes || 0) - 1) });
    }
    const likedR = await db.collectionGroup('replies').where('likedBy', 'array-contains', userKey).get();
    for (const d of likedR.docs) {
      await d.ref.update({ likedBy: admin.firestore.FieldValue.arrayRemove(userKey), likes: Math.max(0, (d.data().likes || 0) - 1) });
    }

    // 6. 수치 정밀 동기화
    for (const cid of Array.from(affectedCaseIds)) {
      await syncCaseCounts(cid);
    }

    // 7. 프로필 최종 삭제
    await db.collection('users').doc(userKey).delete();

    res.status(200).json({ success: true });
  } catch (error) { 
    res.status(200).json({ success: false }); 
  }
});

export { 
  onCaseCreate, onCaseDelete, onVoteCreate, onCommentCreate, 
  onVoteDelete, onCommentDelete, onReplyCreate, onReplyDelete 
} from './triggers';
export { closeExpiredCases } from './scheduled';
export { claimMissionReward } from './mission';
