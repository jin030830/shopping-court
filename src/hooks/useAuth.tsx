import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth, functions } from '../api/firebase';
import { httpsCallable } from 'firebase/functions';
import { getUserData, createOrUpdateUser, type UserDocument } from '../api/user';
import { getCustomTokenFromServer, loginWithToss, signInToFirebase } from '../api/auth';
import { Timestamp } from 'firebase/firestore';

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
    
    // 앱 시작 시 연결 상태 확인 및 정리
    const checkAndCleanupAuth = async () => {
      if (!auth) return;
      
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          // Firebase Auth 토큰 재검증 (사용자가 삭제되었는지 확인)
          try {
            await currentUser.getIdToken(true); // forceRefresh: true로 강제 갱신
          } catch (tokenError: any) {
            // 토큰이 유효하지 않으면 (사용자가 삭제되었을 가능성)
            console.log('[Auth] Token validation failed, user may have been deleted:', tokenError);
            if (auth) {
              await signOut(auth);
            }
            localStorage.removeItem('shopping-court-user');
            localStorage.removeItem('shopping-court-logged-in');
            setUser(null);
            setUserData(null);
            setIsLoading(false);
            return;
          }
          
          // Firestore에서 사용자 데이터 확인 (사용자가 삭제되었는지 검증)
          const userDataFromFirestore = await getUserData(currentUser);
          
          // 사용자 데이터가 없으면 (콜백으로 삭제되었을 가능성) 강제 로그아웃
          if (!userDataFromFirestore) {
            console.log('[Auth] User data not found in Firestore (unlinked), forcing logout');
            try {
              if (auth) {
                await signOut(auth);
              }
              localStorage.removeItem('shopping-court-user');
              localStorage.removeItem('shopping-court-logged-in');
              setUser(null);
              setUserData(null);
              setIsLoading(false);
              return;
            } catch (error) {
              console.error('[Auth] Error during forced logout:', error);
            }
          }
        }
      } catch (error) {
        console.error('[Auth] Error during auth check:', error);
      }
    };
    
    // 초기 검증 실행
    checkAndCleanupAuth();
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Firebase Auth 토큰 재검증 (사용자가 삭제되었는지 확인)
        try {
          await firebaseUser.getIdToken(true); // forceRefresh: true로 강제 갱신
        } catch (tokenError: any) {
          // 토큰이 유효하지 않으면 (사용자가 삭제되었을 가능성)
          console.log('[Auth] Token validation failed, user may have been deleted:', tokenError);
          try {
            if (auth) {
              await signOut(auth);
            }
            localStorage.removeItem('shopping-court-user');
            localStorage.removeItem('shopping-court-logged-in');
            setUser(null);
            setUserData(null);
            setIsLoading(false);
            return;
          } catch (error) {
            console.error('[Auth] Error during forced logout:', error);
          }
        }
        
        // Firestore에서 사용자 데이터 확인 (사용자가 삭제되었는지 검증)
        const userDataFromFirestore = await getUserData(firebaseUser);
        
        // 사용자 데이터가 없으면 (콜백으로 삭제되었을 가능성) 강제 로그아웃
        if (!userDataFromFirestore) {
          console.log('[Auth] User data not found in Firestore (unlinked), forcing logout');
          try {
            if (auth) {
              await signOut(auth);
            }
            localStorage.removeItem('shopping-court-user');
            localStorage.removeItem('shopping-court-logged-in');
            setUser(null);
            setUserData(null);
            setIsLoading(false);
            return;
          } catch (error) {
            console.error('[Auth] Error during forced logout:', error);
          }
        }

        const localData = localStorage.getItem('shopping-court-user');
        if (localData) {
          try {
            const parsedData = JSON.parse(localData);
            // Firestore 데이터와 일치하는지 확인
            if (userDataFromFirestore && parsedData.uid === firebaseUser.uid) {
              setUserData({
                tossUserKey: parsedData.uid,
                nickname: parsedData.nickname,
                createdAt: parsedData.createdAt ? Timestamp.fromDate(new Date(parsedData.createdAt)) : null,
                updatedAt: null,
              });
            } else {
              // Firestore 데이터 사용
              setUserData(userDataFromFirestore);
            }
          } catch {
            // Firestore 데이터 사용
            setUserData(userDataFromFirestore);
          }
        } else {
          // Firestore 데이터 사용
          setUserData(userDataFromFirestore);
        }
        setIsVerified(true);
      } else {
        setUserData(null);
        localStorage.removeItem('shopping-court-user');
        localStorage.removeItem('shopping-court-logged-in');
        setIsVerified(false);
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