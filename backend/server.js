import express from 'express';
import cors from 'cors';
import axios from 'axios';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import dotenv from 'dotenv';
import admin from 'firebase-admin';

// Load service account key using createRequire for broader compatibility
const require = createRequire(import.meta.url);
const serviceAccount = require('./serviceAccountKey.json');

dotenv.config();

// Initialize Firebase Admin SDK
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('✅ Firebase Admin SDK 초기화 성공');
} catch (error) {
  console.error('❌ Firebase Admin SDK 초기화 실패:', error);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// CORS 설정
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://localhost:3000', 
    'http://localhost:8081',
    'http://0.0.0.0:8081'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json());

// 토스 인증서 설정
const certPath = path.resolve(__dirname, 'certs');
const keyPath = path.join(certPath, 'shopping-court_private.key');
const certFilePath = path.join(certPath, 'shopping-court_public.crt');

let httpsAgent = null;
const FORCE_TEST_MODE = process.env.TEST_MODE === 'true';

if (!FORCE_TEST_MODE) {
  try {
    if (fs.existsSync(keyPath) && fs.existsSync(certFilePath)) {
      const keyContent = fs.readFileSync(keyPath, 'utf8');
      const certContent = fs.readFileSync(certFilePath, 'utf8');
      
      httpsAgent = new https.Agent({
        key: keyContent,
        cert: certContent,
        rejectUnauthorized: true,
      });
      
      console.log('✅ mTLS 인증서 로드 성공');
      console.log('📂 인증서 경로:', certPath);
      console.log('🔐 실제 토스 API 모드 활성화');
    } else {
      console.warn('⚠️  인증서 파일을 찾을 수 없습니다.');
      console.warn('📂 경로:', certPath);
      console.warn('🔄 테스트 모드로 전환합니다.');
    }
  } catch (error) {
    console.error('❌ mTLS 인증서 로드 실패:', error.message);
    console.warn('⚠️  인증서 경로:', certPath);
    console.warn('🔄 테스트 모드로 전환합니다.');
  }
} else {
  console.log('📝 TEST_MODE=true: 테스트 모드로 시작합니다.');
}

/**
 * 토스 로그인 엔드포인트
 * POST /api/auth/toss-login
 * Body: { authorizationCode, referrer }
 */
app.post('/api/auth/toss-login', async (req, res) => {
  console.log('🔐 ========== 새 로그인 요청 ==========');
  console.log('📍 Origin:', req.headers.origin);
  console.log('📍 Referer:', req.headers.referer);
  console.log('📦 Request Body:', req.body);
  
  try {
    const { authorizationCode, referrer } = req.body;

    if (!authorizationCode) {
      console.log('❌ authorizationCode 없음!');
      return res.status(400).json({
        resultType: 'FAIL',
        error: {
          errorCode: 'INVALID_PARAMETER',
          reason: 'authorizationCode가 필요합니다.',
        },
      });
    }

    console.log('🔐 토스 로그인 요청 받음:', { 
      authorizationCode: authorizationCode.substring(0, 20) + '...', 
      referrer 
    });

    const TEST_MODE = !httpsAgent || process.env.TEST_MODE === 'true';
    
    let userKey;

    if (TEST_MODE) {
      console.log('📝 테스트 모드: 실제 토스 앱 로그인 시뮬레이션');
      userKey = `toss-test-${authorizationCode.substring(0, 10)}`;
      console.log('✅ 가상 사용자 userKey 생성:', userKey);
    } else {
      // 실제 모드: 토스 API 호출
      const authApiBase = process.env.TOSS_AUTH_API_BASE || 'https://apps-in-toss-api.toss.im';
      const clientId = process.env.TOSS_CLIENT_ID || 'shopping-court';

      console.log('1️⃣ Access Token 요청 시작...');
      const tokenResponse = await axios.post(
        `${authApiBase}/generate-token`,
        { authorizationCode, referrer },
        {
          headers: { 'Content-Type': 'application/json', 'X-Client-Id': clientId },
          httpsAgent,
          timeout: 10000,
        }
      );
      
      const accessToken = tokenResponse.data.success?.accessToken || tokenResponse.data.accessToken;
      if (!accessToken) {
        throw new Error('Access Token을 받지 못했습니다.');
      }
      console.log('✅ Access Token 받기 성공');

      console.log('2️⃣ 사용자 정보 요청 시작...');
      const userInfoResponse = await axios.get(
        `${authApiBase}/login-me`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          httpsAgent,
          timeout: 10000,
        }
      );

      const userInfo = userInfoResponse.data.success || userInfoResponse.data;
      if (!userInfo.userKey) {
        throw new Error('사용자 정보를 받지 못했습니다.');
      }
      userKey = userInfo.userKey;
      console.log('✅ 사용자 정보 받기 성공:', userKey);
    }

    // Firebase 커스텀 토큰 생성
    console.log('3️⃣ Firebase 커스텀 토큰 생성 시작 (uid:', userKey, ')');
    const customToken = await admin.auth().createCustomToken(userKey);
    console.log('✅ Firebase 커스텀 토큰 생성 성공');

    // 응답
    res.json({
      resultType: 'SUCCESS',
      success: {
        customToken: customToken,
      },
    });

  } catch (error) {
    console.error('❌ 토스 로그인 실패:', error.message);
    if (axios.isAxiosError(error)) {
      console.error('토스 API 응답:', error.response?.data);
    }

    res.status(500).json({
      resultType: 'FAIL',
      error: {
        errorCode: 'INTERNAL_SERVER_ERROR',
        reason: error.message || '로그인 처리 중 오류가 발생했습니다.',
      },
    });
  }
});

// 헬스 체크
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '서버가 정상 작동 중입니다.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
🚀 Shopping Court Backend Server
📍 Port: ${PORT}
🔗 Health Check: http://localhost:${PORT}/health
🔐 Auth Endpoint: http://localhost:${PORT}/api/auth/toss-login
  `);
});
