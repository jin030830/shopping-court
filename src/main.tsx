import { AuthProvider } from './hooks/useAuth';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import './api/firebase'; // 에뮬레이터 연결 로직을 포함하므로 import 유지

const rootElement = document.getElementById('root')!;
const root = ReactDOM.createRoot(rootElement);

async function renderApp() {
  const isTossApp = typeof window !== 'undefined' && (window as any).ReactNativeWebView !== undefined;

  // 토스 앱 환경이거나, 로컬 개발 환경일 때만 앱을 렌더링합니다.
  if (isTossApp || import.meta.env.DEV) {
    const { default: App } = await import('./App.tsx');
    
    root.render(
      <React.StrictMode>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </React.StrictMode>
    );
  } else {
    // Vercel 등 실제 배포 환경의 일반 브라우저에서는 안내 문구를 표시합니다.
    root.render(
      <React.StrictMode>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#f0f2f5',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          color: '#333',
          textAlign: 'center',
          padding: '20px'
        }}>
          <h1 style={{ fontSize: '24px', marginBottom: '16px', fontWeight: '600' }}>소비 재판소</h1>
          <p style={{ fontSize: '16px', lineHeight: '1.5' }}>
            이 서비스는 토스 앱 내에서만 이용할 수 있습니다.<br />
            토스 앱을 통해 접속해주세요.
          </p>
        </div>
      </React.StrictMode>
    );
  }
}

renderApp();