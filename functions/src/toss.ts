import * as functions from "firebase-functions";
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

/**
 * 환경 변수에서 토스 API 설정 가져오기
 */
export function getTossApiConfig() {
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
export function createMtlsAgent(): https.Agent {
  try {
    const certPath = path.resolve(__dirname, "..", "certs");
    const keyPath = path.join(certPath, "shopping-court2_private.key");
    const certFilePath = path.join(certPath, "shopping-court2_public.crt");

    return new https.Agent({
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certFilePath),
    });
  } catch (error) {
    console.error("mTLS Agent creation failed:", error);
    throw new functions.https.HttpsError(
      "internal",
      "서버 인증 설정에 실패했습니다."
    );
  }
}

/**
 * 토스 앱으로 푸시 알림(메신저) 발송
 * 문서: https://developers-apps-in-toss.toss.im/push/develop.html
 */
export async function sendTossPush(
  userKey: string,
  context: Record<string, string>,
  templateSetCode: string = "shopping-court-enduser"
): Promise<void> {
  const config = getTossApiConfig();
  const httpsAgent = createMtlsAgent();

  // 테스트 유저(에뮬레이터용)인 경우 실제 API를 호출하지 않고 로그만 출력
  if (userKey.startsWith('dev-user-') || userKey.startsWith('test-user-')) {
    console.log(`[Toss Push SKIP] Test user: ${userKey}, Template: ${templateSetCode}, Context:`, context);
    return;
  }

  try {
    const url = `${config.authApiBase}/api-partner/v1/apps-in-toss/messenger/send-message`;
    
    const response = await axios.post(
      url,
      {
        templateSetCode,
        context
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-toss-user-key": userKey
        },
        httpsAgent
      }
    );
    
    console.log(`[Toss Push SUCCESS] Sent to ${userKey}. Response:`, response.data);
  } catch (error: any) {
    console.error(`[Toss Push ERROR] Failed to send to ${userKey}:`, error.response?.data || error.message);
    // 푸시 실패가 전체 프로세스를 중단시키지 않도록 에러를 throw하지 않습니다.
  }
}

/**
 * 테스트용 메시지 발송 (개발용)
 * 문서: https://developers-apps-in-toss.toss.im/api/sendTestMessage.html
 */
export async function sendTestTossPush(
  userKey: string,
  deploymentId: string,
  context: Record<string, string>,
  templateSetCode?: string // 선택적 파라미터로 변경
): Promise<void> {
  const config = getTossApiConfig();
  const httpsAgent = createMtlsAgent();

  try {
    const url = `${config.authApiBase}/api-partner/v1/apps-in-toss/messenger/send-test-message`;
    
    console.log(`[Toss Test Push] Sending to ${userKey} with deploymentId: ${deploymentId}`);

    const requestBody: any = {
      deploymentId,
      context
    };

    // 템플릿 코드가 있을 때만 포함 (테스트 시 자동 접두사 문제 회피 시도)
    if (templateSetCode) {
      requestBody.templateSetCode = templateSetCode;
    }

    const response = await axios.post(
      url,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          "x-toss-user-key": userKey
        },
        httpsAgent
      }
    );
    
    console.log(`[Toss Test Push SUCCESS] Response:`, response.data);
  } catch (error: any) {
    console.error(`[Toss Test Push ERROR] Failed:`, error.response?.data || error.message);
    throw error;
  }
}
