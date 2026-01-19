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
}

interface TossTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
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
  const authApiBase = process.env.TOSS_AUTH_API_BASE || "https://apps-in-toss-api.toss.im";
  const clientId = process.env.TOSS_CLIENT_ID || "shopping-court";
  const testMode = process.env.TEST_MODE === "true";

  console.log("환경 변수 로드:", {
    authApiBase,
    clientId: clientId ? "설정됨" : "없음",
    testMode,
  });

  return {
    authApiBase,
    clientId,
    testMode,
  };
}

/**
 * 토스 API로 토큰 생성 (mTLS 사용)
 */
async function generateTossToken(authorizationCode: string, referrer: string | undefined): Promise<string> {
  const config = getTossApiConfig();

  // 인증서 경로 설정
  const certPath = path.resolve(__dirname, "certs");
  const keyPath = path.join(certPath, "shopping-court_private.key");
  const certFilePath = path.join(certPath, "shopping-court_public.crt");

  let httpsAgent;
  try {
    httpsAgent = new https.Agent({
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certFilePath),
    });
  } catch (error) {
    console.error("인증서 파일을 읽는 데 실패했습니다. functions/certs 폴더에 파일이 있는지 확인하세요.", error);
    throw new functions.https.HttpsError(
      "internal",
      "서버 인증 설정에 실패했습니다. 인증서 파일을 찾을 수 없습니다."
    );
  }

  try {
    const response = await axios.post<TossTokenResponse>(
      `${config.authApiBase}/api-partner/v1/apps-in-toss/user/oauth2/generate-token`,
      {
        authorizationCode,
        referrer,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Client-Id": config.clientId,
        },
        httpsAgent,
      }
    );

    return response.data.accessToken;
  } catch (error) {
    console.error("mTLS를 이용한 토스 토큰 생성 실패:", error);
    if (axios.isAxiosError(error)) {
      console.error("Toss 서버 응답 데이터:", error.response?.data);
      console.error("Toss 서버 응답 상태:", error.response?.status);
      console.error("Toss 서버 응답 헤더:", error.response?.headers);
      throw new functions.https.HttpsError(
        "internal",
        `토스 토큰 생성 실패: ${error.response?.status} ${error.response?.statusText}`
      );
    }
    throw new functions.https.HttpsError("internal", "토스 토큰 생성에 실패했습니다.");
  }
}

/**
 * 토스 API로 사용자 정보 조회
 */
async function getTossUserInfo(
  accessToken: string
): Promise<TossUserInfoResponse> {
  const config = getTossApiConfig();

  try {
    const response = await axios.get<TossUserInfoResponse>(
      `${config.authApiBase}/login-me`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("토스 사용자 정보 조회 실패:", error);
    if (axios.isAxiosError(error)) {
      throw new functions.https.HttpsError(
        "internal",
        `토스 사용자 정보 조회 실패: ${error.response?.status} ${error.response?.statusText}`
      );
    }
    throw new functions.https.HttpsError(
      "internal",
      "토스 사용자 정보 조회에 실패했습니다."
    );
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
      if (!data.authorizationCode) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "authorizationCode가 필요합니다."
        );
      }

      const config = getTossApiConfig();

      // 테스트 모드: 실제 토스 API 호출 없이 테스트 사용자 생성
      if (config.testMode) {
        console.log("테스트 모드: 가상의 사용자로 로그인합니다.");
        const testUserKey = `test-user-${Date.now()}`;
        const customToken = await admin.auth().createCustomToken(testUserKey);
        
        return {
          customToken,
          tossUserKey: testUserKey,
        };
      }

      // 실제 모드: 토스 API 호출
      const accessToken = await generateTossToken(data.authorizationCode, data.referrer);
      const userInfo = await getTossUserInfo(accessToken);
      const customToken = await admin.auth().createCustomToken(userInfo.userKey);

      return {
        customToken,
        tossUserKey: userInfo.userKey,
      };
    } catch (error) {
      console.error("토스 로그인 처리 오류:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "로그인 처리 중 오류가 발생했습니다.");
    }
  });

// Firestore 트리거 함수들을 export 합니다.
export { onVoteCreate, onCommentCreate, onVoteDelete, onCommentDelete } from './triggers';

// 스케줄링 함수를 export 합니다.
export { closeExpiredCases } from './scheduled';