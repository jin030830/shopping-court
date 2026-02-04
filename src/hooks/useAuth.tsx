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
          try {
            await currentUser.getIdToken(true);
          } catch (tokenError: any) {
            console.log('[Auth] Token validation failed, user may have been deleted:', tokenError);
            if (auth) await signOut(auth);
            localStorage.removeItem('shopping-court-user');
            localStorage.removeItem('shopping-court-logged-in');
            setUser(null);
            setUserData(null);
            setIsLoading(false);
            return;
          }
          
          const userDataFromFirestore = await getUserData(currentUser);
          if (!userDataFromFirestore) {
            console.log('[Auth] User data not found in Firestore (unlinked), forcing logout');
            try {
              if (auth) await signOut(auth);
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
    
    checkAndCleanupAuth();
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          await firebaseUser.getIdToken(true);
        } catch (tokenError: any) {
          console.log('[Auth] Token validation failed, user may have been deleted:', tokenError);
          try {
            if (auth) await signOut(auth);
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
        
        // Firestore에서 사용자 데이터 확인
        const userDataFromFirestore = await getUserData(firebaseUser);
        
        if (!userDataFromFirestore) {
          console.log('[Auth] User data not found in Firestore (unlinked), forcing logout');
          try {
            if (auth) await signOut(auth);
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
            
            // DB 데이터가 있으면 우선적으로 사용하고 로컬 스토리지 갱신
            if (userDataFromFirestore) {
              setUserData(userDataFromFirestore);
              // 로컬 스토리지 갱신
              localStorage.setItem('shopping-court-user', JSON.stringify({
                ...parsedData,
              }));
            } else {
              setUserData({
                ...parsedData,
                createdAt: parsedData.createdAt ? Timestamp.fromDate(new Date(parsedData.createdAt)) : null,
                updatedAt: null,
              } as UserDocument);
            }
          } catch {
            setUserData(userDataFromFirestore);
          }
        } else {
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
      if (functions && userData?.tossUserKey) {
        try {
          const callTossLogout = httpsCallable(functions, 'tossLogout');
          await callTossLogout({ userKey: userData.tossUserKey });
          console.log('✅ 토스 연결 끊기 요청 성공');
        } catch (error) {
          console.error('⚠️ 토스 연결 끊기 실패 (로그아웃은 계속 진행):', error);
        }
      }

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