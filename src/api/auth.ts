import { appLogin } from '@apps-in-toss/web-framework';
import { signInWithCustomToken, type User } from 'firebase/auth';
import { auth, functions } from './firebase';
import { httpsCallable } from 'firebase/functions';

/**
 * 토스 로그인 결과
 */
export interface TossLoginResult {
  authorizationCode: string;
  referrer: string;
}

/**
 * 백엔드 로그인 응답
 */
export interface BackendLoginResponse {
  customToken: string;
}

/**
 * 토스 로그인 실행
 */
export async function loginWithToss(): Promise<TossLoginResult> {
  try {
    const isReactNativeWebView = typeof window !== 'undefined' && (window as any).ReactNativeWebView !== undefined;
    
    if (!isReactNativeWebView) {
      // WEB BROWSER ENVIRONMENT
      console.log('🌐 웹 브라우저 환경 - 실제 토스 앱내앱 로그인 시도');
      // Call SDK's appLogin() to get real authorizationCode
      const { authorizationCode, referrer } = await appLogin(); // Changed 'code' to 'authorizationCode'

      if (!authorizationCode) {
        throw new Error("인가 코드를 받아오지 못했습니다.");
      }

      console.log("받아온 진짜 Auth Code (웹):", authorizationCode); // Changed 'code' to 'authorizationCode'
      return {
        authorizationCode: authorizationCode,
        referrer: referrer || 'WEB_BROWSER_SDK', // Use actual referrer if provided, else a default
      };
    }
    
    const result = await appLogin();
    
    if (!result.authorizationCode) {
      throw new Error('토스 로그인 결과가 올바르지 않습니다.');
    }
    
    return {
      authorizationCode: result.authorizationCode,
      referrer: result.referrer || '',
    };
  } catch (error: any) {
    console.error('토스 로그인 실패:', error);
    if (error?.message?.includes('cancel')) {
      throw new Error('로그인이 취소되었습니다.');
    }
    throw new Error(error?.message || '토스 로그인에 실패했습니다.');
  }
}

/**
 * 백엔드에서 Firebase 커스텀 토큰 받기 (Cloud Function 호출)
 */
export async function getCustomTokenFromServer(
  authorizationCode: string,
  referrer: string
): Promise<BackendLoginResponse> {
  try {
    console.log('🔥 Firebase Cloud Function으로 토스 로그인 요청:', { authorizationCode, referrer });

    if (!functions) {
      throw new Error('Firebase Functions 서비스가 초기화되지 않았습니다.');
    }

    const callTossLogin = httpsCallable(functions, 'tossLogin');
    const response = await callTossLogin({ authorizationCode, referrer });

    const data = response.data as any;

    if (!data || !data.customToken) {
      throw new Error(data.error?.reason || 'Cloud Function으로부터 커스텀 토큰을 받지 못했습니다.');
    }

    console.log('✅ Cloud Function으로부터 커스텀 토큰 받음');
    return {
      customToken: data.customToken,
    };
  } catch (error: any) {
    console.error('❌ Cloud Function 호출 실패:', error);
    throw new Error(error.message || 'Cloud Function 인증에 실패했습니다.');
  }
}

/**
 * 커스텀 토큰으로 Firebase에 로그인
 */
export async function signInToFirebase(customToken: string): Promise<User> {
  if (!auth) {
    throw new Error('Firebase Auth 서비스가 초기화되지 않았습니다.');
  }
  try {
    console.log('🔥 Firebase에 커스텀 토큰으로 로그인 시도...');
    const userCredential = await signInWithCustomToken(auth, customToken);
    console.log('✅ Firebase 로그인 성공:', userCredential.user.uid);
    return userCredential.user;
  } catch (error: any) {
    console.error('❌ Firebase 커스텀 토큰 로그인 실패:', error);
    throw new Error('Firebase 로그인에 실패했습니다.');
  }
}

