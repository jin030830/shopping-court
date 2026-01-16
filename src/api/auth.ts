import { appLogin } from '@apps-in-toss/web-framework'
import { signInAnonymously, type User as FirebaseUser } from 'firebase/auth'
import { auth } from './firebase'

/**
 * 토스 로그인 결과
 */
export interface TossLoginResult {
  authorizationCode: string
  referrer: string
}

/**
 * 백엔드 로그인 응답
 */
export interface BackendLoginResponse {
  userKey: string
  scope: string[]
  agreedTerms: string[]
  nameEncrypted?: string
}

/**
 * 토스 로그인 실행
 */
export async function loginWithToss(): Promise<TossLoginResult> {
  try {
    const result = await appLogin()
    return {
      authorizationCode: result.authorizationCode,
      referrer: result.referrer || '',
    }
  } catch (error) {
    console.error('토스 로그인 실패:', error)
    throw new Error('토스 로그인에 실패했습니다.')
  }
}

/**
 * 백엔드에 토스 로그인 정보 전송
 */
export async function sendTossLoginToBackend(
  authorizationCode: string,
  referrer: string
): Promise<BackendLoginResponse> {
  const functionsUrl = import.meta.env.VITE_FUNCTIONS_URL || ''
  
  if (!functionsUrl) {
    throw new Error('VITE_FUNCTIONS_URL 환경 변수가 설정되지 않았습니다.')
  }

  try {
    const response = await fetch(`${functionsUrl}/toss/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authorizationCode,
        referrer,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `서버 오류: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('백엔드 로그인 실패:', error)
    throw error
  }
}

/**
 * Firebase 익명 로그인 (이미 로그인되어 있으면 스킵)
 */
export async function signInFirebaseAnonymously(): Promise<FirebaseUser> {
  if (!auth) {
    throw new Error('Firebase가 초기화되지 않았습니다.')
  }

  // 이미 로그인되어 있으면 현재 사용자 반환
  const currentUser = auth.currentUser
  if (currentUser && currentUser.isAnonymous) {
    return currentUser
  }

  try {
    const userCredential = await signInAnonymously(auth)
    return userCredential.user
  } catch (error) {
    console.error('Firebase 익명 로그인 실패:', error)
    throw new Error('Firebase 로그인에 실패했습니다.')
  }
}
