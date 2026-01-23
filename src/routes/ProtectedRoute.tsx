import React, { useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';

// 로딩 스피너 컴포넌트
const FullPageSpinner = ({ message = '로딩 중...' }) => (
  <div style={{ 
    display: 'flex', 
    flexDirection: 'column', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  }}>
    <div style={{
      width: '40px',
      height: '40px',
      border: '4px solid #f3f3f3',
      borderTop: '4px solid #3182F6',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      marginBottom: '16px'
    }} />
    <p style={{ color: '#6B7684', fontSize: '15px' }}>{message}</p>
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { user, userData, isLoading, isLoggingIn, login } = useAuth();
  const attemptRef = useRef(false);

  useEffect(() => {
    // 초기 로딩 완료, 비로그인 상태, 아직 로그인 시도 안 함 -> 로그인 실행
    if (!isLoading && !user && !userData && !isLoggingIn && !attemptRef.current) {
      attemptRef.current = true;
      login().catch(() => {
        // 로그인 실패 시 재시도 가능하도록 리셋
        attemptRef.current = false;
      });
    }
  }, [isLoading, user, userData, isLoggingIn, login]);

  // 1. 초기 상태 확인 중
  if (isLoading) {
    return <FullPageSpinner />;
  }

  // 2. 로그인 성공 -> 컨텐츠 표시
  if (user && userData) {
    return children;
  }

  // 3. 로그인 진행 중 또는 시도 중
  if (isLoggingIn || attemptRef.current) {
    return <FullPageSpinner message="로그인 중입니다..." />;
  }

  // 4. 로그인 실패 상태 (useAuth 내부에서 alert 띄움)
  // 여기서는 재시도 버튼을 보여주거나 빈 화면을 유지할 수 있음
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh' 
    }}>
      <p style={{ marginBottom: '16px' }}>로그인이 필요합니다.</p>
      <button 
        onClick={() => login()}
        style={{
          padding: '12px 20px',
          backgroundColor: '#3182F6',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontWeight: '600'
        }}
      >
        다시 로그인하기
      </button>
    </div>
  );
}

export default ProtectedRoute;