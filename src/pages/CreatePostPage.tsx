import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Text } from '@toss/tds-mobile';
import { useAuth } from '../hooks/useAuth';
import { createCase, type CaseData } from '../api/cases';

function CreatePostPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userData, isLoading, login } = useAuth();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [hasShownGuide, setHasShownGuide] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // 중복 제출 방지용 상태

  // 가이드 확인 처리
  const handleGuideConfirm = () => {
    setShowGuideModal(false);
  };

  // 페이지 로드 시 자동으로 팝업 표시
  useEffect(() => {
    if (!hasShownGuide) {
      setShowGuideModal(true);
      setHasShownGuide(true);
    }
  }, [hasShownGuide]);

  useEffect(() => {
    if (!isLoading && (!user || !userData)) {
      alert('로그인이 필요합니다.');
      login();
    }
  }, [isLoading, user, userData, login]);

  const handleSubmit = async () => {
    if (isSubmitting) return; // 이미 제출 중이면 무시

    if (!user || !userData) {
      alert('로그인이 필요합니다.');
      navigate('/login', { state: { from: location } });
      return;
    }

    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }

    setIsSubmitting(true); // 제출 시작

    const caseData: CaseData = {
      title: title.trim(),
      content: content.trim(),
      authorId: user.uid,
      authorNickname: userData.nickname,
    };

    try {
      await createCase(caseData);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('고민 등록 실패:', error);
      alert('고민을 등록하는 데 실패했습니다. 다시 시도해주세요.');
      setIsSubmitting(false); // 실패 시에만 다시 제출 가능하게 복구
    }
  };

  return (
    <div style={{ 
      backgroundColor: 'white', 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* Content Area */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto',
        padding: '20px 20px 100px 20px',
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: 'white'
      }}>
        <Text 
          display="block" 
          color="#191F28ff" 
          typography="t4" 
          fontWeight="bold"
          style={{ marginBottom: '24px' }}
        >
          직접 고민을 적어보세요!
        </Text>

        {/* Title Input */}
        <div style={{ marginBottom: '20px' }}>
          <Text 
            display="block" 
            color="#191F28ff" 
            typography="t7" 
            fontWeight="semibold"
            style={{ marginBottom: '8px' }}
          >
            제목
          </Text>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 적어주세요"
            maxLength={100}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid #E5E5E5',
              borderRadius: '8px',
              fontSize: '15px',
              boxSizing: 'border-box',
              outline: 'none',
              fontFamily: 'inherit',
              backgroundColor: 'white',
              color: '#191F28'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#3182F6';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#E5E5E5';
            }}
          />
        </div>

        {/* Content Input */}
        <div style={{ marginBottom: '20px' }}>
          <Text 
            display="block" 
            color="#191F28ff" 
            typography="t7" 
            fontWeight="semibold"
            style={{ marginBottom: '8px' }}
          >
            내용
          </Text>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="고민을 얘기해보세요"
            style={{
              width: '100%',
              height: '250px',
              padding: '12px 16px',
              border: '1px solid #E5E5E5',
              borderRadius: '8px',
              fontSize: '15px',
              boxSizing: 'border-box',
              outline: 'none',
              resize: 'none',
              fontFamily: 'inherit',
              lineHeight: '1.5',
              backgroundColor: 'white',
              color: '#191F28'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#3182F6';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#E5E5E5';
            }}
          />
        </div>
      </div>

      {/* Fixed Bottom Button */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px 20px',
        backgroundColor: 'white',
        borderTop: '1px solid #e5e5e5',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting} // 제출 중 비활성화
          style={{
            width: '100%',
            padding: '16px',
            backgroundColor: isSubmitting ? '#E5E8EB' : '#3182F6', // 비활성화 시 색상 변경
            color: isSubmitting ? '#B0B8C1' : 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: isSubmitting ? 'not-allowed' : 'pointer'
          }}
        >
          {isSubmitting ? '등록 중...' : '작성 완료'}
        </button>
      </div>

      {/* 가이드 팝업 */}
      {showGuideModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={handleGuideConfirm}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '400px',
              boxSizing: 'border-box'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Text
              display="block"
              color="#191F28ff"
              typography="t4"
              fontWeight="bold"
              style={{ marginBottom: '12px' }}
            >
              아래 정보를 함께 적어주면 좋아요
            </Text>
            
            <Text
              display="block"
              color="#6B7684"
              typography="t7"
              fontWeight="regular"
              style={{ marginBottom: '20px' }}
            >
              ※ 모두 선택 사항이에요!
            </Text>
            
            <div style={{ marginBottom: '24px' }}>
              <Text
                display="block"
                color="#191F28"
                typography="t7"
                fontWeight="regular"
                style={{ marginBottom: '8px' }}
              >
                • 나이/연령대 (예: 20대 후반)
              </Text>
              <Text
                display="block"
                color="#191F28"
                typography="t7"
                fontWeight="regular"
                style={{ marginBottom: '8px' }}
              >
                • 직업/상태 (예: 대학생, 사회초년생)
              </Text>
              <Text
                display="block"
                color="#191F28"
                typography="t7"
                fontWeight="regular"
              >
                • 가계 상황 (여유 있음 / 보통 / 빠듯함)
              </Text>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleGuideConfirm}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#3182F6',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 성공 팝업 */}
      {showSuccessModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => {
            setShowSuccessModal(false);
            navigate('/');
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '400px',
              boxSizing: 'border-box'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Text
              display="block"
              color="#191F28ff"
              typography="t4"
              fontWeight="bold"
              style={{ marginBottom: '12px' }}
            >
              사건 등록이 완료됐어요!
            </Text>
            
            <Text
              display="block"
              color="#6B7684"
              typography="t7"
              fontWeight="regular"
              style={{ marginBottom: '24px' }}
            >
              재판 결과는 48시간 후에 확인할 수 있어요
            </Text>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  navigate('/');
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#3182F6',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreatePostPage;
