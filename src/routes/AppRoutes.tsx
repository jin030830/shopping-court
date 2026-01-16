import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Home from '../pages/Home'
import Terms from '../pages/Terms'
import MarketingConsent from '../pages/MarketingConsent'

// 경로를 소문자로 강제 변환하는 래퍼 컴포넌트
// 실제 컴포넌트가 렌더링되기 전에 경로를 체크하여 대문자가 있으면 리다이렉트
function LowercaseRedirect({ children }: { children: React.ReactElement }) {
  const location = useLocation()
  const pathname = location.pathname
  const lowercasePath = pathname.toLowerCase()
  
  // 경로에 대문자가 포함되어 있으면 소문자로 리다이렉트
  if (pathname !== lowercasePath) {
    return <Navigate to={lowercasePath + location.search + location.hash} replace />
  }
  
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      
      {/* 
        Canonical 소문자 경로만 실제 컴포넌트 렌더링
        LowercaseRedirect로 한 번 더 체크하여 안전성 확보
      */}
      <Route 
        path="/terms" 
        element={
          <LowercaseRedirect>
            <Terms />
          </LowercaseRedirect>
        } 
      />
      <Route 
        path="/marketing-consent" 
        element={
          <LowercaseRedirect>
            <MarketingConsent />
          </LowercaseRedirect>
        } 
      />
      
      {/* 
        대소문자 혼합 경로는 모두 소문자로 리다이렉트만 수행
        실제 컴포넌트를 렌더링하지 않음
      */}
      <Route path="/Terms" element={<Navigate to="/terms" replace />} />
      <Route path="/TERMS" element={<Navigate to="/terms" replace />} />
      <Route path="/TeRms" element={<Navigate to="/terms" replace />} />
      <Route path="/tErMs" element={<Navigate to="/terms" replace />} />
      
      <Route path="/Marketing-consent" element={<Navigate to="/marketing-consent" replace />} />
      <Route path="/MARKETING-CONSENT" element={<Navigate to="/marketing-consent" replace />} />
      <Route path="/Marketing-Consent" element={<Navigate to="/marketing-consent" replace />} />
      <Route path="/marketing-Consent" element={<Navigate to="/marketing-consent" replace />} />
      <Route path="/MARKETING-consent" element={<Navigate to="/marketing-consent" replace />} />
      <Route path="/marketing-CONSENT" element={<Navigate to="/marketing-consent" replace />} />
    </Routes>
  )
}

export default AppRoutes
