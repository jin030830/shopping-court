import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth, functions } from '../api/firebase';
import { httpsCallable } from 'firebase/functions';
import { getUserData, createOrUpdateUser, type UserDocument } from '../api/user';
import { getCustomTokenFromServer, loginWithToss, signInToFirebase } from '../api/auth';

interface AuthContextType {
  user: User | null;
  userData: UserDocument | null;
  isLoading: boolean;
  isLoggingIn: boolean;
  isVerified: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  const login = async () => {
    if (isLoggingIn) return;
    
    setIsLoggingIn(true);
    try {
      const tossResult = await loginWithToss();
      const authData = await getCustomTokenFromServer(
        tossResult.authorizationCode,
        tossResult.referrer
      );

      const firebaseUser = await signInToFirebase(authData.customToken);
      const userDocument = await createOrUpdateUser(firebaseUser);
      
      const storageData = {
        uid: firebaseUser.uid,
        nickname: userDocument.nickname,
        createdAt: userDocument.createdAt?.toDate().toISOString() || new Date().toISOString(),
        isLoggedIn: true,
      };
      
      localStorage.setItem('shopping-court-user', JSON.stringify(storageData));
      localStorage.setItem('shopping-court-logged-in', 'true');
      window.dispatchEvent(new Event('storage'));
      
      setUserData(userDocument);
      setIsVerified(true);
      setIsLoggingIn(false);
      
    } catch (error) {
      console.error('Login error:', error);
      alert(error instanceof Error ? error.message : '로그인에 실패했습니다.');
      setIsLoggingIn(false);
      setIsVerified(false);
    }
  };

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // 로컬 스토리지 데이터 사용하지 않고 항상 DB 조회
        try {
          const data = await getUserData(firebaseUser);
          if (data) {
            setUserData(data);
            // isVerified는 false로 유지하여 재검증 유도 (앱 재진입 시)
          } else {
            await logout();
          }
        } catch (error) {
          console.error('User data sync error:', error);
          setUserData(null);
        }
      } else {
        setUserData(null);
        setIsVerified(false);
        localStorage.removeItem('shopping-court-user');
        localStorage.removeItem('shopping-court-logged-in');
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      // 1. 토스 연결 끊기 (서버 호출)
      if (functions && userData?.tossUserKey) {
        try {
          const callTossLogout = httpsCallable(functions, 'tossLogout');
          await callTossLogout({ userKey: userData.tossUserKey });
          console.log('✅ 토스 연결 끊기 요청 성공');
        } catch (error) {
          console.error('⚠️ 토스 연결 끊기 실패 (로그아웃은 계속 진행):', error);
        }
      }

      // 2. Firebase 로그아웃 및 로컬 정리
      if (auth) {
        await signOut(auth);
        localStorage.removeItem('shopping-court-user');
        localStorage.removeItem('shopping-court-logged-in');
        setUserData(null);
        setUser(null);
        setIsVerified(false);
      }
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, isLoading, isLoggingIn, isVerified, login, logout }}>
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