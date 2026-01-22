import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import CaseDetailPage from '../pages/CaseDetailPage';
import CreatePostPage from '../pages/CreatePostPage';
import EditPostPage from '../pages/EditPostPage';
import TermsPage from '../pages/TermsPage';
import StaticTermsPage from '../pages/StaticTermsPage';
import StaticMarketingPage from '../pages/StaticMarketingPage';
import ProtectedRoute from './ProtectedRoute';

// 경로를 소문자로 강제 변환하고, 필요한 경우 리다이렉트하는 컴포넌트
function LowercaseRedirectWrapper({ children }: { children: React.ReactElement }) {
  const location = useLocation();
  const pathname = location.pathname;
  const lowercasePath = pathname.toLowerCase();
  
  if (pathname !== lowercasePath) {
    return <Navigate to={lowercasePath + location.search + location.hash} replace />;
  }
  
  return children;
}


function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/case/:id" element={<CaseDetailPage />} />
      <Route 
        path="/create-post" 
        element={
          <ProtectedRoute>
            <CreatePostPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/edit-post/:id" 
        element={
          <ProtectedRoute>
            <EditPostPage />
          </ProtectedRoute>
        } 
      />
      
      {/* 약관 동의 플로우를 위한 페이지 */}
      <Route path="/terms" element={<TermsPage />} />

      {/* 약관 내용만 보여주는 정적 페이지 */}
      <Route 
        path="/terms-static" 
        element={
          <LowercaseRedirectWrapper>
            <StaticTermsPage />
          </LowercaseRedirectWrapper>
        } 
      />
      <Route 
        path="/marketing-consent" 
        element={
          <LowercaseRedirectWrapper>
            <StaticMarketingPage />
          </LowercaseRedirectWrapper>
        } 
      />
    </Routes>
  );
}

export default AppRoutes;