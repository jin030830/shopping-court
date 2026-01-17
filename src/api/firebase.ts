import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

let auth: ReturnType<typeof getAuth> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;
let storage: ReturnType<typeof getStorage> | null = null;
let functions: ReturnType<typeof getFunctions> | null = null;

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    functions = getFunctions(app, 'asia-northeast3');

    // 에뮬레이터 사용 여부를 환경 변수로 제어
    const useEmulator = import.meta.env.VITE_USE_EMULATOR === 'true';
    
    if (useEmulator && import.meta.env.DEV) {
      console.log("개발 모드: Firebase 에뮬레이터에 연결합니다.");
      // Auth 에뮬레이터
      connectAuthEmulator(auth, "http://localhost:9099");
      // Firestore 에뮬레이터
      connectFirestoreEmulator(db, 'localhost', 8080);
      // Functions 에뮬레이터
      connectFunctionsEmulator(functions, "localhost", 5001);
    } else {
      console.log("실제 Firebase에 연결합니다.");
    }
  } catch (error) {
    console.error("Firebase 초기화 실패:", error);
  }
} else {
  console.warn("Firebase 환경 변수가 설정되지 않았습니다. Firebase 기능을 사용할 수 없습니다.");
}

export { app, auth, db, storage, functions };