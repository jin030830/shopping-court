# 환경 변수 설정 가이드

## 클라이언트 (.env 파일)

프로젝트 루트에 `.env` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# Firebase 설정
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# Firebase Functions URL
# 로컬 개발: http://localhost:5001/your-project-id/asia-northeast3/tossLogin
# 배포 후: https://asia-northeast3-your-project-id.cloudfunctions.net/tossLogin
VITE_FUNCTIONS_URL=http://localhost:5001/your-project-id/asia-northeast3/tossLogin
```

## Firebase Functions 환경 변수

Firebase Functions 배포 후 다음 명령어로 환경 변수를 설정하세요:

```bash
cd functions

# 토스 API 설정
firebase functions:config:set \
  toss.auth_api_base="https://api.toss.im" \
  toss.client_id="your-client-id" \
  toss.client_secret="your-client-secret" \
  toss.decryption_key="your-decryption-key" \
  toss.aad="your-aad"
```

또는 `firebase.json`이나 Firebase 콘솔에서도 설정할 수 있습니다.

## 참고

- `.env` 파일은 Git에 커밋하지 마세요 (`.gitignore`에 추가되어 있습니다)
- 배포 시에는 배포 플랫폼(Vercel, Netlify 등)의 환경 변수 설정에서도 동일하게 설정해야 합니다
