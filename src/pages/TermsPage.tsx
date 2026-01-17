import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './TermsPage.css';
import { getCustomTokenFromServer, loginWithToss } from '../api/auth';


function TermsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [agreements, setAgreements] = useState({
    thirdParty: false,
    terms: false,
    privacy: false,
    marketing: false,
  });

  const allRequiredAgreed = agreements.thirdParty && agreements.terms && agreements.privacy;

  const handleAgreementChange = (name: keyof typeof agreements) => {
    setAgreements(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleAllAgree = () => {
    const allChecked = agreements.thirdParty && agreements.terms && agreements.privacy && agreements.marketing;
    const newCheckedState = !allChecked;
    setAgreements({
      thirdParty: newCheckedState,
      terms: newCheckedState,
      privacy: newCheckedState,
      marketing: newCheckedState,
    });
  };

  const handleStart = async () => {
    if (!allRequiredAgreed) {
      return;
    }
    
    // 에러 상태 초기화
    setError(null);
    setIsLoading(true);
    
    try {
      console.log('📱 1단계: 토스 앱 로그인 시작...');
      console.log('💡 토스 앱에서 로그인 알림을 확인해주세요!');
      
      // 토스 앱 로그인 실행 (토스 앱이 열리고 사용자 승인 대기)
      const tossResult = await loginWithToss();
      
      console.log('✅ 2단계: 토스 로그인 완료!');
      console.log('🔐 authorizationCode:', tossResult.authorizationCode ? '받음' : '없음');
      
      // 백엔드 서버로 authorizationCode 전송
      console.log('🌐 3단계: 서버 인증 시작...');
      const serverResponse = await getCustomTokenFromServer(
        tossResult.authorizationCode,
        tossResult.referrer
      );
      
      console.log('✅ 4단계: 서버 인증 완료!');
      console.log('👤 사용자 정보:', serverResponse);
      
      // localStorage에 로그인 정보 저장
      const userData = {
        uid: `toss-${serverResponse.userKey}`,
        userKey: serverResponse.userKey,
        nickname: serverResponse.nickname,
        createdAt: new Date().toISOString(),
        isLoggedIn: true,
      };
      
      localStorage.setItem('shopping-court-user', JSON.stringify(userData));
      localStorage.setItem('shopping-court-logged-in', 'true');
      
      console.log('💾 5단계: 로그인 상태 저장 완료!');
      console.log('🎉 로그인 성공:', userData.nickname);
      console.log('📦 저장된 데이터:', localStorage.getItem('shopping-court-user'));
      console.log('📦 로그인 플래그:', localStorage.getItem('shopping-court-logged-in'));
      
      // localStorage 변경 이벤트 강제 발생
      window.dispatchEvent(new Event('storage'));
      
      // 인증 성공 후 원래 페이지로 돌아가기
      const from = location.state?.from?.pathname || '/';
      console.log('🔙 원래 페이지로 이동:', from);
      
      // 로그인 상태가 반영될 시간 제공
      setTimeout(() => {
        console.log('🚀 페이지 이동 시작...');
        navigate(from, { replace: true });
        setIsLoading(false);
        
        // 페이지 새로고침으로 상태 완전히 반영
        setTimeout(() => {
          window.location.href = from;
        }, 100);
      }, 300);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '로그인에 실패했습니다.';
      setError(errorMessage);
      console.error('❌ 로그인 실패:', err);
      // 에러 발생 시 로딩 상태 해제 (사용자가 다시 시도할 수 있도록)
      setIsLoading(false);
    }
  };
  
  const agreementItems = [
    { key: 'thirdParty', text: '개인정보 제3자 제공 동의', required: true, link: '/terms-static' },
    { key: 'terms', text: '서비스 이용약관', required: true, link: '/terms-static' },
    { key: 'privacy', text: '개인정보 처리방침', required: true, link: '/terms-static' },
    { key: 'marketing', text: '마케팅 정보 수신 동의', required: false, link: '/marketing-consent' },
  ];

  return (
    <div className="terms-container">
      <div className="terms-header">
         <button onClick={() => navigate(-1)} className="back-button">
          {'<'}
        </button>
      </div>
      
      <div className="terms-content">
        <h1>
          소비 재판소에
          <br />
          토스로 로그인할까요?
        </h1>
        
        <div className="agreement-section">
          <div className="agreement-item all-agree">
            <label>
              <input
                type="checkbox"
                checked={agreementItems.every(item => agreements[item.key as keyof typeof agreements])}
                onChange={handleAllAgree}
              />
              <b>전체 동의</b>
            </label>
          </div>

          <hr className="divider" />

          {agreementItems.map(item => (
            <div className="agreement-item" key={item.key}>
              <label>
                <input
                  type="checkbox"
                  name={item.key}
                  checked={agreements[item.key as keyof typeof agreements]}
                  onChange={() => handleAgreementChange(item.key as keyof typeof agreements)}
                />
                {item.required && '[필수] '} {item.text}
              </label>
              <Link to={item.link} target="_blank" className="view-link">보기</Link>
            </div>
          ))}
        </div>
      </div>

      <div className="terms-footer">
        <button
          className="start-button"
          disabled={!allRequiredAgreed || isLoading}
          onClick={handleStart}
        >
          {isLoading ? '진행 중...' : '동의하고 시작하기'}
        </button>
        {error && (
          <div className="error-container">
            <p className="error-message">{error}</p>
            <button
              onClick={() => {
                setError(null);
                setIsLoading(false);
              }}
              className="retry-button"
              disabled={isLoading}
            >
              다시 시도
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default TermsPage;