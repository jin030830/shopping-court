import { AuthProvider } from './hooks/useAuth';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import './api/firebase'; // 에뮬레이터 연결 로직을 포함하므로 import 유지

const rootElement = document.getElementById('root')!;
const root = ReactDOM.createRoot(rootElement);

async function renderApp() {
  // 로컬 개발 환경이 아니면 무조건 앱을 렌더링합니다.
  // (토스 앱에서만 접근 가능한 서비스이므로)
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
}

renderApp();