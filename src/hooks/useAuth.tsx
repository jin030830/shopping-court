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
  isLoggingIn: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const login = async () => {
    if (isLoggingIn || (user && userData)) return;
    
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
      
      setIsLoggingIn(false);
      window.location.reload(); // SPA 상태 동기화를 위해 페이지 새로고침
      
    } catch (error) {
      console.error('Login error:', error);
      alert(error instanceof Error ? error.message : '로그인에 실패했습니다.');
      setIsLoggingIn(false);
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
            const data = await getUserData(firebaseUser);
            setUserData(data);
          }
        } else {
          const data = await getUserData(firebaseUser);
          setUserData(data);
        }
      } else {
        setUserData(null);
        localStorage.removeItem('shopping-court-user');
        localStorage.removeItem('shopping-court-logged-in');
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      if (auth) {
        await signOut(auth);
      }
    } catch (error) {
      console.error('Logout error:', error);
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