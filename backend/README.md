# Backend Setup Guide

이 가이드는 Shopping Court 앱의 Express.js 백엔드 서버를 설정하고 실행하는 방법을 설명합니다.

## 1. 환경 변수 설정

`backend/` 디렉토리에 `.env` 파일을 생성하고 다음 내용을 입력하세요:

```env
TOSS_AUTH_API_BASE=https://apps-in-toss-api.toss.im
TOSS_CLIENT_ID=shopping-court
TEST_MODE=true
PORT=8080
```

**환경 변수 설명:**
- `TOSS_AUTH_API_BASE`: Toss 인증 API의 기본 URL
- `TOSS_CLIENT_ID`: Toss Client ID
- `TEST_MODE`: `true`로 설정하면 실제 Toss API 호출을 건너뛰고 개발 모드로 작동합니다. 프로덕션에서는 `false`로 설정하세요.
- `PORT`: 백엔드 서버가 리스닝할 포트

## 2. mTLS 인증서 (프로덕션/실제 Toss API 호출 시)

`TEST_MODE`가 `false`인 경우, mTLS 인증서가 필요합니다.

`shopping-court_private.key`와 `shopping-court_public.crt` 파일을 `backend/certs/` 디렉토리에 배치하세요.

**⚠️ 보안상의 이유로 이 파일들은 Git에 커밋되지 않습니다.**

## 3. 의존성 설치

`backend` 디렉토리로 이동하여 Node.js 의존성을 설치하세요:

```bash
cd backend
npm install
```

## 4. 백엔드 서버 실행

백엔드 서버를 시작하세요:

```bash
npm run dev
```

서버는 기본적으로 `http://localhost:8080`에서 실행됩니다.

## 5. 친구가 403 오류를 겪는 경우

친구가 코드를 pull한 후 403 오류가 발생한다면:

1. `.env` 파일이 있는지 확인 (없다면 위의 1번 단계 참고)
2. `TEST_MODE=true`로 설정되어 있는지 확인
3. `backend` 디렉토리에서 `npm install` 실행
4. `npm run dev`로 백엔드 서버 재시작
5. 프론트엔드도 재시작 (`npm run dev`)

## 문제 해결

- **EADDRINUSE 오류**: 포트가 이미 사용 중입니다. 실행 중인 프로세스를 종료하거나 `.env`에서 다른 포트를 사용하세요.
- **403 오류**: `.env` 파일이 올바르게 설정되어 있고 `TEST_MODE=true`인지 확인하세요.
- **인증서 오류**: `TEST_MODE=true`로 설정하여 개발 중에는 인증서 없이 작동하도록 하세요.
