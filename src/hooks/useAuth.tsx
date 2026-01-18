import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from '../api/firebase';
import { getUserData } from '../api/user';
import type { UserDocument } from '../api/user';

interface AuthContextType {
  user: User | null;
  userData: UserDocument | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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
              createdAt: parsedData.createdAt ? new Date(parsedData.createdAt) : null,
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

  const logout = async () => {
    try {
      await signOut(auth);
      // onAuthStateChanged가 user와 userData를 null로 설정하고 localStorage를 정리함
      console.log('✅ 로그아웃 요청 성공');
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