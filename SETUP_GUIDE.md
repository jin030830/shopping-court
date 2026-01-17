# 토스 로그인 설정 가이드

## 현재 문제
"서버 오류가 발생했습니다: internal" 에러가 발생하는 이유는 Firebase Functions가 제대로 설정되지 않았기 때문입니다.

## 필요한 설정

### 1. 토스 개발자 센터에서 필요한 정보 받기

토스 개발자 센터(https://developers.toss.im)에서 다음 정보를 받아야 합니다:

- **Client ID**: 토스 앱 로그인 클라이언트 ID
- **인증서 파일**: 
  - `shopping-court1_private.key` (개인 키)
  - `shopping-court1_public.crt` (공개 인증서)
- **Auth API Base URL**: 일반적으로 `https://api.toss.im`

### 2. 인증서 파일 설치

받은 인증서 파일을 `functions/certs/` 폴더에 넣어주세요:

```
functions/
  certs/
    shopping-court1_private.key
    shopping-court1_public.crt
```

### 3. Functions 환경 변수 설정

`functions/.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
TOSS_AUTH_API_BASE=https://api.toss.im
TOSS_CLIENT_ID=your-client-id-here
```

### 4. Firebase Functions 배포

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

## 임시 테스트 방법 (실제 토스 로그인 없이)

토스 인증서가 준비되지 않았다면, 테스트용으로 Firebase Functions를 수정하여 가상의 사용자로 로그인할 수 있습니다.

### 테스트 모드 활성화

`functions/src/index.ts`를 수정하여 테스트 모드를 추가할 수 있습니다.

## 다음 단계

1. 토스 개발자 센터에서 계정 생성 및 앱 등록
2. 인증서 및 Client ID 발급
3. 위 설정 완료 후 Functions 배포
4. 앱에서 로그인 테스트

## 문의

토스 개발자 센터: https://developers.toss.im
