import { AuthProvider } from './hooks/useAuth';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from '@toss/tds-mobile';
import './index.css';
import './api/firebase'; // 에뮬레이터 연결 로직을 포함하므로 import 유지

const rootElement = document.getElementById('root')!;
const root = ReactDOM.createRoot(rootElement);

async function renderApp() {
  try {
    console.log('[Shopping Court] 앱 렌더링 시작');
    console.log('[Shopping Court] URL:', window.location.href);
    console.log('[Shopping Court] pathname:', window.location.pathname);
    console.log('[Shopping Court] search:', window.location.search);
    console.log('[Shopping Court] ReactNativeWebView:', (window as any).ReactNativeWebView !== undefined);
    
    // 프로덕션 환경에서는 무조건 앱을 렌더링합니다.
    // (토스 앱에서만 접근 가능한 서비스이므로)
    const { default: App } = await import('./App.tsx');
    
    console.log('[Shopping Court] App 컴포넌트 로드 완료');
    
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <ThemeProvider>
            <BrowserRouter>
              <AuthProvider>
                <App />
              </AuthProvider>
            </BrowserRouter>
          </ThemeProvider>
        </ErrorBoundary>
      </React.StrictMode>
    );
    
    console.log('[Shopping Court] 렌더링 완료');
  } catch (error) {
    console.error('[Shopping Court] 렌더링 에러:', error);
    
    // 에러 발생 시 에러 화면 표시
    root.render(
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#f0f2f5',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#333',
        textAlign: 'center',
        padding: '20px'
      }}>
        <h1 style={{ fontSize: '24px', marginBottom: '16px', fontWeight: '600' }}>오류가 발생했습니다</h1>
        <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#666' }}>
          {error instanceof Error ? error.message : '알 수 없는 오류'}
        </p>
        <button 
          onClick={() => window.location.reload()} 
          style={{
            marginTop: '20px',
            padding: '12px 24px',
            backgroundColor: '#0064FF',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }
}

renderApp();