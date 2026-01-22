import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";
import * as fs from "fs";
import * as https from "https";
import * as path from "path";
import * as dotenv from "dotenv";

// .env 파일 로드를 위해 dotenv 설정 (로컬 개발용)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Firebase Admin 초기화
admin.initializeApp();

// 인터페이스 정의
interface TossLoginRequest {
  authorizationCode: string;
  referrer?: string;
  developerId?: string; // 프론트엔드에서 보낼 ID
}

// 토스 API의 실제 응답 구조를 반영한 인터페이스
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
  userKey: string;
  scope: string[];
  agreedTerms: string[];
  nameEncrypted?: string;
}

/**
 * 환경 변수에서 토스 API 설정 가져오기
 */
function getTossApiConfig() {
  const tossConfig = functions.config().toss;

  const authApiBase = tossConfig?.auth_api_base || process.env.TOSS_AUTH_API_BASE || "https://apps-in-toss-api.toss.im";
  const clientId = tossConfig?.client_id || process.env.TOSS_CLIENT_ID || "shopping-court";
  
  // TEST_MODE 설정
  const testMode = process.env.TEST_MODE === "true";

  return {
    authApiBase,
    clientId,
    testMode,
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
    console.error("인증서 파일을 읽는 데 실패했습니다.", error);
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
    console.error("토스 토큰 생성 실패:", error);
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
    return response.data;
  } catch (error) {
    console.error("토스 사용자 정보 조회 실패:", error);
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
      // ✅ [핵심 수정] 배포된 서버에서도 developerId가 넘어오면 즉시 개발자 모드로 처리합니다.
      if (data.developerId) {
        console.log(`👨‍💻 개발자 모드 강제 활성화: '${data.developerId}'님으로 로그인합니다.`);
        const devUserKey = `dev-user-${data.developerId}`;
        const customToken = await admin.auth().createCustomToken(devUserKey);
        
        return {
          customToken,
          tossUserKey: devUserKey,
        };
      }

      // 실제 운영 흐름
      if (!data.authorizationCode) {
        throw new functions.https.HttpsError("invalid-argument", "authorizationCode가 필요합니다.");
      }

      const config = getTossApiConfig();

      // TEST_MODE 처리 (필요시)
      if (config.testMode) {
        const testUserKey = `test-user-${Date.now()}`;
        const customToken = await admin.auth().createCustomToken(testUserKey);
        return { customToken, tossUserKey: testUserKey };
      }

      const accessToken = await generateTossToken(data.authorizationCode, data.referrer);
      const userInfo = await getTossUserInfo(accessToken);
      const customToken = await admin.auth().createCustomToken(String(userInfo.userKey));

      return {
        customToken,
        tossUserKey: userInfo.userKey,
      };
    } catch (error) {
      console.error("토스 로그인 처리 오류:", error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError("internal", "로그인 처리 중 오류가 발생했습니다.");
    }
  });

export { onVoteCreate, onCommentCreate, onVoteDelete, onCommentDelete } from './triggers';
export { closeExpiredCases } from './scheduled';