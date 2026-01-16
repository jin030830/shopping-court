import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import type { User as FirebaseUser } from 'firebase/auth'
import reactLogo from '../assets/react.svg'
import viteLogo from '/vite.svg'
import '../App.css'
import { loginWithToss, sendTossLoginToBackend, signInFirebaseAnonymously } from '../api/auth'
import { createOrUpdateUser, getUserData } from '../api/user'
import type { UserDocument } from '../api/user'
import { auth } from '../api/firebase'

function Home() {
  const [count, setCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [userData, setUserData] = useState<UserDocument | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Firebase 인증 상태 감지
  useEffect(() => {
    if (!auth) return

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      
      if (firebaseUser) {
        // 사용자 데이터 조회
        const data = await getUserData(firebaseUser)
        setUserData(data)
      } else {
        setUserData(null)
      }
    })

    return () => unsubscribe()
  }, [])

  const handleTossLogin = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // 1. 토스 로그인
      const tossResult = await loginWithToss()
      console.log('토스 로그인 성공:', tossResult)

      // 2. 백엔드에 토스 로그인 정보 전송
      const backendResult = await sendTossLoginToBackend(
        tossResult.authorizationCode,
        tossResult.referrer
      )
      console.log('백엔드 로그인 성공:', backendResult)

      // 3. Firebase 익명 로그인
      const firebaseUser = await signInFirebaseAnonymously()
      console.log('Firebase 로그인 성공:', firebaseUser.uid)

      // 4. Firestore에 사용자 문서 생성/업데이트
      const userDoc = await createOrUpdateUser(
        firebaseUser,
        backendResult.userKey
      )
      console.log('사용자 문서 저장 성공:', userDoc)

      // 5. 상태 업데이트
      setUserData(userDoc)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '로그인에 실패했습니다.'
      setError(errorMessage)
      console.error('로그인 오류:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="home-container">
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      
      {/* 로그인 상태 표시 */}
      <div className="card" style={{ marginTop: '2rem' }}>
        {user && userData ? (
          <div style={{ textAlign: 'left', padding: '1rem' }}>
            <h3>로그인 상태</h3>
            <p><strong>닉네임:</strong> {userData.nickname}</p>
            <p><strong>토스 UserKey:</strong> {userData.tossUserKey}</p>
            <p><strong>Firebase UID:</strong> {user.uid}</p>
          </div>
        ) : (
          <div>
            <p>로그인이 필요합니다.</p>
            <button 
              onClick={handleTossLogin} 
              disabled={isLoading}
              style={{ marginTop: '1rem' }}
            >
              {isLoading ? '로그인 중...' : '토스 로그인'}
            </button>
          </div>
        )}
        
        {error && (
          <div style={{ marginTop: '1rem', padding: '0.5rem', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px' }}>
            오류: {error}
          </div>
        )}
      </div>

      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
      <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Link to="/terms" style={{ color: '#646cff', textDecoration: 'underline' }}>
          서비스 이용약관
        </Link>
        <Link to="/marketing-consent" style={{ color: '#646cff', textDecoration: 'underline' }}>
          마케팅 정보 수신 동의
        </Link>
      </div>
    </div>
  )
}

export default Home
