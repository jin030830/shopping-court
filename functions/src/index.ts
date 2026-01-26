import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";
import * as fs from "fs";
import * as https from "https";
import * as path from "path";
import * as dotenv from "dotenv";

// .env 파일 로드 (로컬 개발용)
try {
  if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
  }
} catch (e) {
  // Silent ignore in production
}

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
 * 환경 변수에서 토스 API 설정 가져오기
 */
function getTossApiConfig() {
  const tossConfig = functions.config().toss;

  const authApiBase = tossConfig?.auth_api_base || process.env.TOSS_AUTH_API_BASE || "https://apps-in-toss-api.toss.im";
  const clientId = tossConfig?.client_id || process.env.TOSS_CLIENT_ID || "shopping-court";
  
  const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
  const testMode = isEmulator && (process.env.TEST_MODE === "true" || tossConfig?.test_mode === "true");

  return {
    authApiBase,
    clientId,
    testMode,
    isEmulator,
  };
}

/**
 * mTLS 인증을 위한 https.Agent 생성
 */
function createMtlsAgent(): https.Agent {
  try {
    const certPath = path.resolve(__dirname, "..", "certs");
    const keyPath = path.join(certPath, "shopping-court2_private.key");
    const certFilePath = path.join(certPath, "shopping-court2_public.crt");

    return new https.Agent({
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certFilePath),
    });
  } catch (error) {
    throw new functions.https.HttpsError(
      "internal",
      "서버 인증 설정에 실패했습니다."
    );
  }
}

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
<<<<<<< HEAD
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
      // 참고: userKey는 토스에서 발급한 사용자 식별자이며, Firebase UID로 사용됩니다
      try {
        console.log(`[Toss Unlink Callback] Attempting to find Firebase user: ${userKey}`);
        const firebaseUser = await admin.auth().getUser(userKey);
        
        if (firebaseUser) {
          console.log(`[Toss Unlink Callback] Firebase user found: ${userKey}, email: ${firebaseUser.email || 'N/A'}`);
          
          // Firebase Auth에서 사용자 삭제 (모든 세션 무효화)
          // 이렇게 하면 클라이언트에서 자동으로 로그아웃됩니다
          await admin.auth().deleteUser(userKey);
          console.log(`[Toss Unlink Callback] ✅ Firebase Auth user deleted successfully: ${userKey}`);

          // Firestore의 users 컬렉션에서도 사용자 데이터 삭제
          try {
            await admin.firestore().collection('users').doc(userKey).delete();
            console.log(`[Toss Unlink Callback] ✅ Firestore user data deleted successfully: ${userKey}`);
          } catch (firestoreError: any) {
            console.warn(`[Toss Unlink Callback] ⚠️ Failed to delete Firestore user data: ${firestoreError.message}`);
            // Firestore 삭제 실패는 치명적이지 않으므로 계속 진행
          }
        } else {
          console.log(`[Toss Unlink Callback] Firebase user not found: ${userKey}`);
        }
      } catch (authError: any) {
        // 사용자가 존재하지 않는 경우도 정상 처리 (이미 삭제되었거나 없는 경우)
        if (authError.code === 'auth/user-not-found') {
          console.log(`[Toss Unlink Callback] ⚠️ Firebase user not found (already deleted?): ${userKey}`);
        } else {
          console.error(`[Toss Unlink Callback] ❌ Error deleting Firebase user:`, {
            code: authError.code,
            message: authError.message,
            stack: authError.stack
          });
          // 에러가 발생해도 200 응답 (토스에 성공으로 알림하여 재시도 방지)
        }
      }

      // 성공 응답
      // 참고: 토스는 200 응답을 받으면 성공으로 간주합니다
      console.log(`[Toss Unlink Callback] ✅ Successfully processed unlink request`);
      res.status(200).json({ 
        success: true, 
        userKey,
        referrer: referrer || 'N/A',
        message: 'User unlinked successfully'
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

export { onVoteCreate, onCommentCreate, onVoteDelete, onCommentDelete } from './triggers';
export { closeExpiredCases } from './scheduled';