import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import ProtectedRoute from './ProtectedRoute';
import ScrollRestoration from '../components/ScrollRestoration';
import { Text } from '@toss/tds-mobile';

// 페이지 지연 로딩 (Code Splitting)
const HomePage = lazy(() => import('../pages/HomePage'));
const CaseDetailPage = lazy(() => import('../pages/CaseDetailPage'));
const CreatePostPage = lazy(() => import('../pages/CreatePostPage'));
const EditPostPage = lazy(() => import('../pages/EditPostPage'));
const StaticTermsPage = lazy(() => import('../pages/StaticTermsPage'));
const StaticMarketingPage = lazy(() => import('../pages/StaticMarketingPage'));
const PointMissionPage = lazy(() => import('../pages/PointMissionPage'));
const CompletedTrendingPage = lazy(() => import('../pages/CompletedTrendingPage'));
const CompletedPreviousPage = lazy(() => import('../pages/CompletedPreviousPage'));
const MyPostsPage = lazy(() => import('../pages/MyPostsPage'));

// 로딩 화면 컴포넌트
const LoadingFallback = () => (
  <div style={{ padding: '40px', textAlign: 'center' }}>
    <Text color="#6B7684">로딩 중...</Text>
  </div>
);

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
      <Suspense fallback={<LoadingFallback />}>
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
          <Route 
            path="/terms-static"
            element={
              <LowercaseRedirectWrapper>
                <StaticTermsPage />
              </LowercaseRedirectWrapper>
            } 
          />
          <Route 
            path="/terms"
            element={<StaticTermsPage />} 
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
      </Suspense>
    </>
  );
}

export default AppRoutes;