import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

// 로딩 스피너 컴포넌트 (실제 프로젝트에 맞게 수정 필요)
const FullPageSpinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <p>로딩 중...</p>
  </div>
);

function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { user, userData, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    // 인증 상태를 확인하는 동안 로딩 인디케이터를 보여줍니다.
    return <FullPageSpinner />;
  }

  if (!user || !userData) {
    // 로딩이 끝났지만 사용자가 없으면 로그인 페이지로 리디렉션합니다.
    // 사용자가 원래 가려던 경로를 state에 담아서 보냅니다.
    return <Navigate to="/terms" state={{ from: location }} replace />;
  }

  // 사용자가 있으면 요청된 자식 컴포넌트를 렌더링합니다.
  return children;
}

export default ProtectedRoute;
