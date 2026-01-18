import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './TermsPage.css';
import { getCustomTokenFromServer, loginWithToss, signInToFirebase } from '../api/auth';
import { createOrUpdateUser } from '../api/user';


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
    
    setError(null);
    setIsLoading(true);
    
    try {
      console.log('📱 1단계: 토스 앱 로그인 시작...');
      const tossResult = await loginWithToss();
      console.log('✅ 2단계: 토스 로그인 완료!');
      
      console.log('🌐 3단계: 서버에서 커스텀 토큰 요청...');
      const authData = await getCustomTokenFromServer(
        tossResult.authorizationCode,
        tossResult.referrer
      );
      console.log('✅ 4단계: 서버로부터 커스텀 토큰 수신 완료');

      console.log('🔥 5단계: Firebase 로그인 시작...');
      const firebaseUser = await signInToFirebase(authData.customToken);
      console.log('✅ 6단계: Firebase 로그인 성공! UID:', firebaseUser.uid);

      console.log('👤 7단계: Firestore에서 사용자 정보 가져오기/생성...');
      const userDocument = await createOrUpdateUser(firebaseUser);
      console.log('✅ 8단계: 사용자 정보 확인:', userDocument.nickname);
      
      // localStorage에 실제 Firebase 사용자 정보 저장
      const userData = {
        uid: firebaseUser.uid,
        nickname: userDocument.nickname, // Firestore에서 받은 닉네임 사용
        createdAt: userDocument.createdAt?.toDate().toISOString() || new Date().toISOString(),
        isLoggedIn: true,
      };
      
      localStorage.setItem('shopping-court-user', JSON.stringify(userData));
      localStorage.setItem('shopping-court-logged-in', 'true');
      
      console.log('💾 9단계: 로그인 상태 저장 완료!');
      console.log('🎉 로그인 성공:', userData.nickname);
      
      window.dispatchEvent(new Event('storage'));
      
      const from = location.state?.from?.pathname || '/';
      console.log('🔙 원래 페이지로 이동:', from);
      
      setTimeout(() => {
        navigate(from, { replace: true });
        setIsLoading(false);
        
        setTimeout(() => {
          window.location.href = from;
        }, 100);
      }, 300);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '로그인에 실패했습니다.';
      setError(errorMessage);
      console.error('❌ 로그인 실패:', err);
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