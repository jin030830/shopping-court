import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth } from '../api/firebase';
import { getUserData } from '../api/user';
import type { UserDocument } from '../api/user';

interface AuthContextType {
  user: FirebaseUser | null;
  userData: UserDocument | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isAuthChecked = false;
    
    const checkAuth = () => {
      // 이미 로그인 확인되었으면 더 이상 체크하지 않음
      if (isAuthChecked) return true;
      
      // 먼저 로컬스토리지에서 로그인 상태 확인
      const isLoggedIn = localStorage.getItem('shopping-court-logged-in') === 'true';
      const localData = localStorage.getItem('shopping-court-user');
      
      if (isLoggedIn && localData) {
        try {
          // 이미 로그인된 상태면 로컬스토리지 데이터 사용
          const userData = JSON.parse(localData);
          console.log('✅ 로그인 복원:', userData.nickname);
          setUserData({
            tossUserKey: userData.userKey,
            nickname: userData.nickname,
            createdAt: null,
            updatedAt: null,
          });
          // 가상 user 객체 생성
          setUser({
            uid: userData.uid,
            displayName: userData.nickname,
          } as FirebaseUser);
          setIsLoading(false);
          isAuthChecked = true;
          return true;
        } catch (error) {
          console.error('❌ localStorage 파싱 실패:', error);
          return false;
        }
      } else {
        // 로그인되지 않은 상태
        setIsLoading(false);
        return false;
      }
    };

    // 초기 체크
    checkAuth();

    // localStorage 변경 감지
    const handleStorageChange = () => {
      isAuthChecked = false; // 새로운 변경이 있으면 다시 체크
      checkAuth();
    };

    window.addEventListener('storage', handleStorageChange);
    
    // 직접 변경도 감지 (같은 탭에서의 변경)
    const intervalId = setInterval(() => {
      if (!isAuthChecked) {
        checkAuth();
      }
    }, 300);

    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        // localStorage 체크가 먼저 있으므로 Firebase는 보조 수단
        if (!localStorage.getItem('shopping-court-logged-in')) {
          setUser(firebaseUser);
          if (firebaseUser) {
            try {
              const data = await getUserData(firebaseUser);
              setUserData(data);
            } catch (error) {
              console.warn('사용자 정보를 찾을 수 없습니다:', error);
            }
          } else {
            setUserData(null);
          }
          setIsLoading(false);
        }
      });

      return () => {
        unsubscribe();
        clearInterval(intervalId);
        window.removeEventListener('storage', handleStorageChange);
      };
    } else {
      setIsLoading(false);
      return () => {
        clearInterval(intervalId);
        window.removeEventListener('storage', handleStorageChange);
      };
    }
  }, []);

  const logout = async () => {
    try {
      // 1. localStorage 클리어
      localStorage.removeItem('shopping-court-user');
      localStorage.removeItem('shopping-court-logged-in');
      console.log('로컬스토리지 클리어 완료');
      
      // 2. Firebase 로그아웃
      if (auth && user) {
        await signOut(auth);
        console.log('Firebase 로그아웃 완료');
      }
      
      // 3. 상태 초기화
      setUser(null);
      setUserData(null);
      
      console.log('✅ 로그아웃 완료');
    } catch (error) {
      console.error('❌ 로그아웃 실패:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, isLoading, logout }}>
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