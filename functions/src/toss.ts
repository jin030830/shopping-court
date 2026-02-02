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
 * 토스 API 에러 처리 헬퍼
 */
function handleTossError(error: any, contextMsg: string): never {
  const responseData = error.response?.data;
  const statusCode = error.response?.status;
  
  // 토스 에러 응답 구조 분석 (code 또는 error.errorCode 등)
  // 문서상 4자리 숫자 코드(4100 등)가 반환됨
  const errorCode = responseData?.code || responseData?.error?.errorCode || responseData?.error?.code;
  const errorMessage = responseData?.message || responseData?.error?.reason || "알 수 없는 오류";

  console.error(`[Toss API Error] ${contextMsg}:`, {
    status: statusCode,
    code: errorCode,
    message: errorMessage,
    data: responseData
  });

  // 에러 코드별 메시지 매핑
  let userMessage = "프로모션 처리 중 오류가 발생했습니다.";
  let firebaseErrorCode: functions.https.FunctionsErrorCode = "internal";

  switch (String(errorCode)) {
    case "4100":
      userMessage = "프로모션 정보를 찾을 수 없습니다.";
      firebaseErrorCode = "not-found";
      break;
    case "4109":
      userMessage = "현재 진행 중인 프로모션이 아닙니다 (종료됨).";
      firebaseErrorCode = "failed-precondition";
      break;
    case "4110":
      userMessage = "일시적인 시스템 오류로 리워드를 지급할 수 없습니다. 잠시 후 다시 시도해주세요.";
      firebaseErrorCode = "unavailable";
      break;
    case "4112":
      userMessage = "프로모션 예산이 소진되었습니다.";
      firebaseErrorCode = "resource-exhausted";
      break;
    case "4113":
      userMessage = "이미 지급된 리워드입니다.";
      firebaseErrorCode = "already-exists";
      break;
    case "4114":
    case "4116":
      userMessage = "지급 한도를 초과했습니다.";
      firebaseErrorCode = "out-of-range";
      break;
    default:
      userMessage = `오류가 발생했습니다: ${errorMessage}`;
  }

  throw new functions.https.HttpsError(firebaseErrorCode, userMessage, {
    originalCode: errorCode,
    originalMessage: errorMessage
  });
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
          "x-toss-user-key": userKey,
          "X-Client-Id": config.clientId
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
          "x-toss-user-key": userKey,
          "X-Client-Id": config.clientId
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

/**
 * 프로모션 리워드 지급을 위한 Key 생성
 * 문서: https://developers-apps-in-toss.toss.im/promotion/develop.html
 */
export async function getPromotionKey(
  userKey: string,
  promotionCode: string
): Promise<string> {
  const config = getTossApiConfig();
  const httpsAgent = createMtlsAgent();

  try {
    const url = `${config.authApiBase}/api-partner/v1/apps-in-toss/promotion/execute-promotion/get-key`;
    
    const response = await axios.post(
      url,
      {
        promotionCode
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-toss-user-key": userKey,
          "X-Client-Id": config.clientId
        },
        httpsAgent
      }
    );
    
    return response.data.promotionExecutionKey;
  } catch (error: any) {
    handleTossError(error, `Promotion Key Issue Failed (user: ${userKey})`);
  }
}

/**
 * 프로모션 리워드 지급 실행
 */
export async function executePromotion(
  userKey: string,
  promotionCode: string,
  key: string, // promotionExecutionKey -> key로 변경
  amount: number
): Promise<any> {
  const config = getTossApiConfig();
  const httpsAgent = createMtlsAgent();

  try {
    const url = `${config.authApiBase}/api-partner/v1/apps-in-toss/promotion/execute-promotion`;
    
    const response = await axios.post(
      url,
      {
        promotionCode,
        key, // 문서 규격: 'key'
        amount
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-toss-user-key": userKey, // 필수 헤더
          "X-Client-Id": config.clientId
        },
        httpsAgent
      }
    );
    
    return response.data;
  } catch (error: any) {
    handleTossError(error, `Promotion Execution Failed (user: ${userKey})`);
  }
}
