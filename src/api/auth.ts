import { appLogin } from '@apps-in-toss/web-framework';
import { signInWithCustomToken } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
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
  userKey: string;
  nickname: string;
}

/**
 * 토스 로그인 실행
 */
export async function loginWithToss(): Promise<TossLoginResult> {
  try {
    // ReactNativeWebView 환경 체크
    const isReactNativeWebView = typeof window !== 'undefined' && 
      (window as any).ReactNativeWebView !== undefined;
    
    if (!isReactNativeWebView) {
      // 웹 브라우저 환경에서는 테스트용 mock 데이터 반환
      console.log('⚠️ 웹 브라우저 환경 - 테스트 모드로 로그인');
      const mockCode = 'web-test-' + Math.random().toString(36).substr(2, 9);
      return {
        authorizationCode: mockCode,
        referrer: 'WEB_BROWSER',
      };
    }
    
    const result = await appLogin();
    
    if (!result.authorizationCode) {
      console.error('토스 로그인 결과에 authorizationCode가 없습니다:', result);
      throw new Error('토스 로그인 결과가 올바르지 않습니다.');
    }
    
    return {
      authorizationCode: result.authorizationCode,
      referrer: result.referrer || '',
    };
  } catch (error: any) {
    console.error('토스 로그인 실패:', error);
    
    // 사용자가 취소한 경우
    if (error?.message?.includes('cancel') || error?.code === 'auth/cancelled') {
      throw new Error('로그인이 취소되었습니다.');
    }
    
    throw new Error(error?.message || '토스 로그인에 실패했습니다.');
  }
}

/**
 * 백엔드에 토스 로그인 정보 전송 (Express Server)
 */
export async function getCustomTokenFromServer(
  authorizationCode: string,
  referrer: string
): Promise<{ userKey: string; nickname: string }> {
  try {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
    
    console.log('Express 서버로 토스 로그인 요청:', backendUrl);
    
    const response = await fetch(`${backendUrl}/api/auth/toss-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authorizationCode,
        referrer,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.error?.reason || errorData.error || '서버 인증에 실패했습니다.';
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    // 토스 API 공통 응답 형식 처리
    if (data.resultType !== 'SUCCESS' || !data.success) {
      const errorMessage = data.error?.reason || '서버 응답이 올바르지 않습니다.';
      throw new Error(errorMessage);
    }

    console.log('✅ 서버에서 사용자 정보 받음:', data.success);
    
    return {
      userKey: data.success.userKey,
      nickname: data.success.nickname,
    };
  } catch (error: any) {
    console.error('백엔드 로그인 요청 실패:', error);
    throw new Error(error?.message || '서버 인증에 실패했습니다.');
  }
}

