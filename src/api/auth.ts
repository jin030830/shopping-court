import { appLogin } from '@apps-in-toss/web-framework';
import { signInWithCustomToken, type User } from 'firebase/auth';
import { auth } from './firebase';

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
      console.log('⚠️ 웹 브라우저 환경 - 테스트 모드로 로그인');
      const mockCode = 'web-test-' + Math.random().toString(36).substr(2, 9);
      return {
        authorizationCode: mockCode,
        referrer: 'WEB_BROWSER',
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
 * 백엔드에서 Firebase 커스텀 토큰 받기
 */
export async function getCustomTokenFromServer(
  authorizationCode: string,
  referrer: string
): Promise<BackendLoginResponse> {
  try {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
    console.log('Express 서버로 토스 로그인 요청:', backendUrl);

    const response = await fetch(`${backendUrl}/api/auth/toss-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorizationCode, referrer }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('서버 응답 에러:', errorText);
      throw new Error('서버 인증에 실패했습니다.');
    }

    const data = await response.json();
    
    if (data.resultType !== 'SUCCESS' || !data.success?.customToken) {
      throw new Error(data.error?.reason || '서버로부터 커스텀 토큰을 받지 못했습니다.');
    }

    console.log('✅ 서버에서 커스텀 토큰 받음');
    return {
      customToken: data.success.customToken,
    };
  } catch (error: any) {
    console.error('백엔드 로그인 요청 실패:', error);
    throw new Error(error.message || '서버 인증에 실패했습니다.');
  }
}

/**
 * 커스텀 토큰으로 Firebase에 로그인
 */
export async function signInToFirebase(customToken: string): Promise<User> {
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

