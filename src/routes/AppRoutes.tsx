import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import CaseDetailPage from '../pages/CaseDetailPage';
import CreatePostPage from '../pages/CreatePostPage';
import EditPostPage from '../pages/EditPostPage';
import StaticTermsPage from '../pages/StaticTermsPage';
import StaticMarketingPage from '../pages/StaticMarketingPage';
import PointMissionPage from '../pages/PointMissionPage';
import CompletedTrendingPage from '../pages/CompletedTrendingPage';
import CompletedPreviousPage from '../pages/CompletedPreviousPage';
import MyPostsPage from '../pages/MyPostsPage';
import ProtectedRoute from './ProtectedRoute';
import ScrollRestoration from '../components/ScrollRestoration';

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
    <>
      <ScrollRestoration />
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
      
      {/* 약관 내용만 보여주는 정적 페이지 (참고용으로 유지) */}
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
      <Route path="/point-mission" element={<PointMissionPage />} />
      <Route path="/completed-trending" element={<CompletedTrendingPage />} />
      <Route path="/completed-previous" element={<CompletedPreviousPage />} />
      <Route 
        path="/my-posts" 
        element={
          <ProtectedRoute>
            <MyPostsPage />
          </ProtectedRoute>
        } 
      />
    </Routes>
    </>
  );
}

export default AppRoutes;