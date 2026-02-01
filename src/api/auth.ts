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
    const developerId = import.meta.env.VITE_DEVELOPER_ID || null;
    
    if (!isReactNativeWebView) {
      if (developerId) {
        return {
          authorizationCode: 'MOCK_CODE_FOR_BROWSER',
          referrer: 'WEB_BROWSER_TEST',
        };
      }
      throw new Error('토스 앱 내부에서만 로그인이 가능합니다.');
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
    const developerId = import.meta.env.VITE_DEVELOPER_ID || null;
    const isReactNativeWebView = typeof window !== 'undefined' && (window as any).ReactNativeWebView !== undefined;

    if (!functions) {
      throw new Error('Firebase Functions 서비스가 초기화되지 않았습니다.');
    }

    const payload: any = { authorizationCode, referrer };
    if (!isReactNativeWebView && developerId) {
      payload.developerId = developerId;
    }

    const callTossLogin = httpsCallable(functions, 'tossLogin');
    const response = await callTossLogin(payload);

    const data = response.data as any;

    if (!data || !data.customToken) {
      throw new Error(data.error?.reason || '인증 토큰을 받지 못했습니다.');
    }

    return {
      customToken: data.customToken,
    };
  } catch (error: any) {
    throw new Error(error.message || '인증에 실패했습니다.');
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
    const userCredential = await signInWithCustomToken(auth, customToken);
    return userCredential.user;
  } catch (error: any) {
    throw new Error('Firebase 로그인에 실패했습니다.');
  }
}