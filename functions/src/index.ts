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
 * 토스 로그인 연결 해제 콜백 처리 (토스 서버로부터 호출됨)
 */
export const tossUnlinkCallback = functions
  .region("asia-northeast3")
  .https.onRequest(async (req, res) => {
    try {
      // 1. Basic Auth 검증 (환경 변수 사용)
      const tossConfig = functions.config().toss;
      const callbackAuthId = tossConfig?.callback_id;
      const callbackAuthPw = tossConfig?.callback_pw;
      
      if (!callbackAuthId || !callbackAuthPw) {
        console.error("[tossUnlinkCallback] Callback Auth configuration is missing");
        res.status(500).send("Server configuration error");
        return;
      }

      const authHeader = req.headers.authorization;
      const expectedAuth = "Basic " + Buffer.from(`${callbackAuthId}:${callbackAuthPw}`).toString("base64");

      if (!authHeader || authHeader !== expectedAuth) {
        console.warn("[tossUnlinkCallback] Unauthorized access attempt");
        res.status(401).send("Unauthorized");
        return;
      }

      // 2. 파라미터 추출
      const userKey = req.body.userKey || req.query.userKey;
      const referrer = req.body.referrer || req.query.referrer;

      if (!userKey) {
        res.status(400).send("Missing userKey");
        return;
      }

      console.log(`[tossUnlinkCallback] Validated unlink callback for referrer: ${referrer}`);

      // 3. Firebase Auth 세션 무효화
      try {
        await admin.auth().revokeRefreshTokens(String(userKey));
        console.log(`[tossUnlinkCallback] Successfully revoked tokens for user key`);
      } catch (authError) {
        console.error(`[tossUnlinkCallback] Failed to revoke tokens`, authError);
      }

      res.status(200).send("OK");
    } catch (error) {
      console.error("[tossUnlinkCallback] Internal error:", error);
      res.status(500).send("Internal Server Error");
    }
  });

export { onVoteCreate, onCommentCreate, onVoteDelete, onCommentDelete } from './triggers';
export { closeExpiredCases } from './scheduled';