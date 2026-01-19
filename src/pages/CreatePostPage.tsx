import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Asset, Text } from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { useAuth } from '../hooks/useAuth';
import { createCase, type CaseData } from '../api/cases';

function CreatePostPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userData, isLoading } = useAuth();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [hasShownGuide, setHasShownGuide] = useState(false);

  // 가이드 팝업 표시 여부 확인
  const checkAndShowGuide = () => {
    if (!hasShownGuide) {
      setShowGuideModal(true);
      setHasShownGuide(true);
    }
  };

  // 가이드 확인 처리
  const handleGuideConfirm = () => {
    setShowGuideModal(false);
  };

  useEffect(() => {
    if (!isLoading && (!user || !userData)) {
      alert('로그인이 필요합니다.');
      navigate('/terms', { state: { from: location } });
    }
  }, [isLoading, user, userData, navigate, location]);

  const handleSubmit = async () => {
    if (!user || !userData) {
      alert('로그인이 필요합니다.');
      navigate('/terms', { state: { from: location } });
      return;
    }

    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }

    const caseData: CaseData = {
      title: title.trim(),
      content: content.trim(),
      authorId: user.uid,
      authorNickname: userData.nickname,
    };

    try {
      await createCase(caseData);
      alert('고민이 등록되었습니다!');
      navigate('/');
    } catch (error) {
      console.error('고민 등록 실패:', error);
      alert('고민을 등록하는 데 실패했습니다. 다시 시도해주세요.');
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
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: '1px solid #e5e5e5',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <Asset.Icon
            frameShape={Asset.frameShape.CleanW24}
            backgroundColor="transparent"
            name="icon-arrow-back-ios-mono"
            color={adaptive.grey900}
            aria-label="뒤로가기"
          />
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Asset.Image
            frameShape={Asset.frameShape.CleanW16}
            backgroundColor="transparent"
            src="https://static.toss.im/appsintoss/15155/4dfa3fe7-556e-424d-820a-61a865a49168.png"
            aria-hidden={true}
            style={{ width: '24px', height: '24px' }}
          />
          <Text color={adaptive.grey900} typography="t6" fontWeight="semibold">
            소비 재판소
          </Text>
        </div>

        <div style={{ width: '32px' }} />
      </div>

      {/* Content Area */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto',
        padding: '20px 20px 100px 20px',
        width: '100%',
        boxSizing: 'border-box'
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
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              fontSize: '15px',
              boxSizing: 'border-box',
              outline: 'none',
              fontFamily: 'inherit'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#3182F6';
              checkAndShowGuide();
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e5e5e5';
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
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              fontSize: '15px',
              boxSizing: 'border-box',
              outline: 'none',
              resize: 'none',
              fontFamily: 'inherit',
              lineHeight: '1.5'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#3182F6';
              checkAndShowGuide();
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e5e5e5';
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
          style={{
            width: '100%',
            padding: '16px',
            backgroundColor: '#3182F6',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          작성 완료
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
              style={{ marginBottom: '20px' }}
            >
              아래 내용은 포함되길 권장드려요!
            </Text>
            
            <div style={{ marginBottom: '24px' }}>
              <Text
                display="block"
                color={adaptive.grey700}
                typography="t7"
                fontWeight="regular"
                style={{ marginBottom: '8px' }}
              >
                연령대
              </Text>
              <Text
                display="block"
                color={adaptive.grey700}
                typography="t7"
                fontWeight="regular"
                style={{ marginBottom: '8px' }}
              >
                나이
              </Text>
              <Text
                display="block"
                color={adaptive.grey700}
                typography="t7"
                fontWeight="regular"
                style={{ marginBottom: '8px' }}
              >
                현재 직업
              </Text>
              <Text
                display="block"
                color={adaptive.grey700}
                typography="t7"
                fontWeight="regular"
                style={{ marginBottom: '8px' }}
              >
                현재 가계 상황
              </Text>
              <Text
                display="block"
                color={adaptive.grey700}
                typography="t7"
                fontWeight="regular"
              >
                소비하려는 것에 대한 정보
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
                확인했습니다!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreatePostPage;
