import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] 에러 발생:', error);
    console.error('[ErrorBoundary] 에러 정보:', errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
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
          <h1 style={{ fontSize: '24px', marginBottom: '16px', fontWeight: '600', color: '#e63946' }}>
            오류가 발생했습니다
          </h1>
          <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#666', marginBottom: '20px' }}>
            {this.state.error?.message || '알 수 없는 오류'}
          </p>
          {this.state.errorInfo && (
            <details style={{ 
              marginBottom: '20px', 
              padding: '10px', 
              backgroundColor: '#fff',
              borderRadius: '8px',
              maxWidth: '80%',
              textAlign: 'left'
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>상세 정보</summary>
              <pre style={{ 
                fontSize: '12px', 
                whiteSpace: 'pre-wrap', 
                wordBreak: 'break-word',
                marginTop: '10px'
              }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <button 
            onClick={() => window.location.reload()} 
            style={{
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

    return this.props.children;
  }
}

export default ErrorBoundary;
