import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import axios from 'axios'

// Firebase Admin 초기화
admin.initializeApp()

/**
 * 토스 로그인 요청 타입
 */
interface TossLoginRequest {
  authorizationCode: string
  referrer?: string
}

/**
 * 토스 토큰 생성 응답 타입
 */
interface TossTokenResponse {
  accessToken: string
  tokenType: string
  expiresIn: number
}

/**
 * 토스 로그인 정보 응답 타입
 */
interface TossUserInfoResponse {
  userKey: string
  scope: string[]
  agreedTerms: string[]
  nameEncrypted?: string
}

/**
 * 환경 변수에서 토스 API 설정 가져오기
 */
function getTossApiConfig() {
  const authApiBase = functions.config().toss?.auth_api_base
  const clientId = functions.config().toss?.client_id
  const clientSecret = functions.config().toss?.client_secret
  const decryptionKey = functions.config().toss?.decryption_key
  const aad = functions.config().toss?.aad

  if (!authApiBase || !clientId || !clientSecret) {
    throw new Error('토스 API 설정이 완료되지 않았습니다.')
  }

  return {
    authApiBase,
    clientId,
    clientSecret,
    decryptionKey,
    aad,
  }
}

/**
 * 토스 API로 토큰 생성
 */
async function generateTossToken(authorizationCode: string): Promise<string> {
  const config = getTossApiConfig()
  
  try {
    const response = await axios.post<TossTokenResponse>(
      `${config.authApiBase}/generate-token`,
      {
        code: authorizationCode,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': config.clientId,
          'X-Client-Secret': config.clientSecret,
        },
      }
    )

    return response.data.accessToken
  } catch (error) {
    console.error('토스 토큰 생성 실패:', error)
    if (axios.isAxiosError(error)) {
      throw new Error(
        `토스 토큰 생성 실패: ${error.response?.status} ${error.response?.statusText}`
      )
    }
    throw new Error('토스 토큰 생성에 실패했습니다.')
  }
}

/**
 * 토스 API로 사용자 정보 조회
 */
async function getTossUserInfo(accessToken: string): Promise<TossUserInfoResponse> {
  const config = getTossApiConfig()
  
  try {
    const response = await axios.get<TossUserInfoResponse>(
      `${config.authApiBase}/login-me`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    return response.data
  } catch (error) {
    console.error('토스 사용자 정보 조회 실패:', error)
    if (axios.isAxiosError(error)) {
      throw new Error(
        `토스 사용자 정보 조회 실패: ${error.response?.status} ${error.response?.statusText}`
      )
    }
    throw new Error('토스 사용자 정보 조회에 실패했습니다.')
  }
}

/**
 * 토스 로그인 처리 HTTP 함수
 * POST /toss/login
 */
export const tossLogin = functions
  .region('asia-northeast3') // 서울 리전
  .https.onRequest(async (req, res) => {
    // CORS 설정
    res.set('Access-Control-Allow-Origin', '*')
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.set('Access-Control-Allow-Headers', 'Content-Type')

    // OPTIONS 요청 처리
    if (req.method === 'OPTIONS') {
      res.status(204).send('')
      return
    }

    // POST 요청만 허용
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    try {
      const body: TossLoginRequest = req.body

      // 요청 데이터 검증
      if (!body.authorizationCode) {
        res.status(400).json({ error: 'authorizationCode가 필요합니다.' })
        return
      }

      // 1. 토스 토큰 생성
      const accessToken = await generateTossToken(body.authorizationCode)

      // 2. 토스 사용자 정보 조회
      const userInfo = await getTossUserInfo(accessToken)

      // 3. 응답 반환
      res.status(200).json({
        userKey: userInfo.userKey,
        scope: userInfo.scope || [],
        agreedTerms: userInfo.agreedTerms || [],
        nameEncrypted: userInfo.nameEncrypted,
      })
    } catch (error) {
      console.error('토스 로그인 처리 오류:', error)
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
      res.status(500).json({ error: errorMessage })
    }
  })
