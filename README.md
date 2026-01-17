# 소비 재판소 (Shopping Court)

소비와 관련된 고민을 공유하고 투표할 수 있는 커뮤니티 플랫폼입니다.

---

## 🚀 시작하기

### 1. 저장소 클론

```bash
git clone https://github.com/jin030830/shopping-court.git
cd shopping-court
```

### 2. 의존성 설치

**프론트엔드:**
```bash
npm install
```

**백엔드:**
```bash
cd backend
npm install
cd ..
```

### 3. 환경 설정

**백엔드 환경 변수 설정:**
```bash
cd backend
cp .env.example .env
```

`.env` 파일이 생성되면 기본 설정으로 테스트 모드가 활성화됩니다.

### 4. 서버 실행

**터미널 1 - 백엔드 서버:**
```bash
cd backend
npm run dev
```

**터미널 2 - 프론트엔드 서버:**
```bash
npm run dev
```

---

## 🌐 접속 방법

### 웹 브라우저
```
http://localhost:5173
```

### 토스 샌드박스 앱
```
intoss://shopping-court
```

---

## ⚙️ 환경 변수

### 프론트엔드
- Firebase 설정은 `src/api/firebase.ts`에 있습니다

### 백엔드
- `backend/.env` 파일 참조
- 자세한 내용은 `backend/README.md` 참조

---

## 🛠️ 주요 기능

- ✅ 게시물 작성/수정/삭제
- ✅ 투표 시스템 (합리적이다/비합리적이다)
- ✅ 투표 결과 시각화
- ✅ 댓글 및 답글
- ✅ 좋아요(공감) 기능
- ✅ Toss 로그인 연동
- ✅ TDS 디자인 시스템

---

## 📁 프로젝트 구조

```
shopping-court/
├── src/                    # 프론트엔드 소스
│   ├── pages/             # 페이지 컴포넌트
│   ├── hooks/             # React Hooks
│   ├── api/               # API 함수
│   └── routes/            # 라우팅 설정
├── backend/               # 백엔드 서버
│   ├── server.js          # Express 서버
│   ├── .env.example       # 환경 변수 예시
│   └── README.md          # 백엔드 가이드
├── functions/             # Firebase Functions (미사용)
└── granite.config.ts      # Granite 설정

```

---

## 🔧 기술 스택

### 프론트엔드
- React + TypeScript
- React Router
- Toss Design System (TDS)
- Vite
- Firebase Authentication

### 백엔드
- Node.js + Express
- localStorage (임시 저장소)

---

## ❓ 문제 해결

### 로그인 403 오류

**증상:** 로그인 시도 시 403 에러 발생

**원인:** 백엔드 환경 변수 미설정

**해결:**
1. `backend/.env` 파일 생성 확인
2. `TEST_MODE=true` 설정 확인
3. 백엔드 서버 재시작

자세한 내용은 `backend/README.md` 참조

### 프론트엔드가 시작되지 않음

**증상:** `npm run dev` 실행 시 오류

**원인:** `granite.config.ts` 파일 누락 또는 손상

**해결:**
```bash
git restore granite.config.ts
```

### 포트 충돌

**증상:** `EADDRINUSE` 에러

**해결:**
```bash
# 프론트엔드 (5173 포트)
lsof -ti:5173 | xargs kill -9

# 백엔드 (8080 포트)
lsof -ti:8080 | xargs kill -9
```

---

## 📝 개발 가이드

### 브랜치 전략
- `main`: 프로덕션 브랜치
- `feat#N`: 기능 개발 브랜치
- `setting#N`: 설정 브랜치

### 커밋 메시지
```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅
refactor: 코드 리팩토링
```

---

## 📄 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.
