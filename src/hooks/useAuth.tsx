import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from '../api/firebase';
import { getUserData, createOrUpdateUser, type UserDocument } from '../api/user';
import { getCustomTokenFromServer, loginWithToss, signInToFirebase } from '../api/auth';
import { Timestamp } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  userData: UserDocument | null;
  isLoading: boolean;
  isLoggingIn: boolean; // 로그인 진행 상태 추가
  login: () => Promise<void>; // 로그인 함수 추가
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }
    // Firebase의 인증 상태 변경을 감지하는 리스너 설정
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        console.log('🔥 Firebase 인증 상태 변경: 로그인 됨 (uid:', firebaseUser.uid, ')');
        // localStorage에서 닉네임 등 부가 정보 복원 시도
        const localData = localStorage.getItem('shopping-court-user');
        if (localData) {
          try {
            const parsedData = JSON.parse(localData);
            setUserData({
              tossUserKey: parsedData.uid,
              nickname: parsedData.nickname,
              createdAt: parsedData.createdAt ? Timestamp.fromDate(new Date(parsedData.createdAt)) : null,
              updatedAt: null,
            });
          } catch {
            // 파싱 실패 시 Firestore에서 데이터 가져오기
            const data = await getUserData(firebaseUser);
            setUserData(data);
          }
        } else {
          // localStorage에 데이터가 없으면 Firestore에서 가져오기
          const data = await getUserData(firebaseUser);
          setUserData(data);
        }
      } else {
        console.log('🔥 Firebase 인증 상태 변경: 로그아웃 됨');
        setUserData(null);
        // 로그아웃 시 로컬 스토리지도 정리
        localStorage.removeItem('shopping-court-user');
        localStorage.removeItem('shopping-court-logged-in');
      }
      setIsLoading(false);
    });

    // 컴포넌트 언마운트 시 리스너 정리
    return () => unsubscribe();
  }, []);

  const login = async () => {
    if (isLoggingIn || (user && userData)) return;
    
    setIsLoggingIn(true);
    try {
      console.log('📱 1단계: 토스 앱 로그인 시작...');
      const tossResult = await loginWithToss();
      console.log('✅ 2단계: 토스 로그인 완료!');
      
      console.log('🌐 3단계: 서버에서 커스텀 토큰 요청...');
      const authData = await getCustomTokenFromServer(
        tossResult.authorizationCode,
        tossResult.referrer
      );
      console.log('✅ 4단계: 서버로부터 커스텀 토큰 수신 완료');

      console.log('🔥 5단계: Firebase 로그인 시작...');
      const firebaseUser = await signInToFirebase(authData.customToken);
      console.log('✅ 6단계: Firebase 로그인 성공! UID:', firebaseUser.uid);

      console.log('👤 7단계: Firestore에서 사용자 정보 가져오기/생성...');
      const userDocument = await createOrUpdateUser(firebaseUser);
      console.log('✅ 8단계: 사용자 정보 확인:', userDocument.nickname);
      
      const storageData = {
        uid: firebaseUser.uid,
        nickname: userDocument.nickname,
        createdAt: userDocument.createdAt?.toDate().toISOString() || new Date().toISOString(),
        isLoggedIn: true,
      };
      
      localStorage.setItem('shopping-court-user', JSON.stringify(storageData));
      localStorage.setItem('shopping-court-logged-in', 'true');
      
      console.log('💾 9단계: 로그인 상태 저장 완료!');
      window.dispatchEvent(new Event('storage'));
      
    } catch (error) {
      console.error('❌ 로그인 실패:', error);
      alert(error instanceof Error ? error.message : '로그인에 실패했습니다.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = async () => {
    try {
      if (auth) {
        await signOut(auth);
        console.log('✅ 로그아웃 요청 성공');
      }
    } catch (error) {
      console.error('❌ 로그아웃 실패:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, isLoading, isLoggingIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};