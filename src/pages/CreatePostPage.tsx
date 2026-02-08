import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Asset, Text, Spacing, Modal, Button } from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { useAuth } from '../hooks/useAuth';
import { createCase, type CaseData } from '../api/cases';
import { useTossAd } from '../hooks/useTossAd';
import missionBannerImage from '../assets/missionbanner.jpeg';

function CreatePostPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userData, isLoading, login } = useAuth();
  const { show: showAd } = useTossAd('ait-ad-test-interstitial-id');

  // 뒤로가기 핸들러
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/', { state: { selectedTab: returnTab }, replace: true });
    }
  };

  // 글쓰기 진입 전 보고 있던 탭 (작성 완료 후 복귀용)
  const returnTab =
    (location.state as any)?.fromTab ||
    sessionStorage.getItem('createPostFromTab') ||
    'HOT 게시판';
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [hasShownGuide, setHasShownGuide] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showAdPopup, setShowAdPopup] = useState(false);
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

  // TDS Modal 배경색 강제 설정
  useEffect(() => {
    if (showGuideModal || showSuccessModal || showAdPopup) {
      const applyOverlayStyle = () => {
        // 모든 가능한 오버레이 요소 찾기
        const selectors = [
          '[data-radix-dialog-overlay]',
          '[data-radix-portal] > div',
          '.custom-modal-overlay'
        ];
        
        selectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach((element: any) => {
            if (element && element.style) {
              const computedStyle = window.getComputedStyle(element);
              // 오버레이 요소인지 확인 (position fixed이고 z-index가 높은 경우)
              if (computedStyle.position === 'fixed' && 
                  parseInt(computedStyle.zIndex) > 1000) {
                element.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
              }
            }
          });
        });
      };

      // 즉시 실행
      setTimeout(applyOverlayStyle, 0);
      
      // 주기적으로 체크
      const interval = setInterval(applyOverlayStyle, 100);
      
      // MutationObserver로 DOM 변경 감지
      const observer = new MutationObserver(applyOverlayStyle);
      observer.observe(document.body, { childList: true, subtree: true });
      
      return () => {
        clearInterval(interval);
        observer.disconnect();
      };
    }
  }, [showGuideModal, showSuccessModal, showAdPopup]);

  useEffect(() => {
    // state로 전달된 fromTab이 있으면 sessionStorage에도 저장 (새로고침/뒤로가기 대비)
    const fromTab = (location.state as any)?.fromTab;
    if (fromTab) {
      sessionStorage.setItem('createPostFromTab', fromTab);
    }
  }, [location.state]);

  useEffect(() => {
    if (!isLoading && (!user || !userData)) {
      alert('로그인이 필요합니다.');
      login();
    }
  }, [isLoading, user, userData, login]);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (!user || !userData) {
      alert('로그인이 필요합니다.');
      login();
      return;
    }

    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }

    // 광고 안내 팝업 표시
    setShowAdPopup(true);
  };

  const handleAdConfirm = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    setShowAdPopup(false);

    // 전면 광고 노출
    showAd(async () => {
      const caseData: CaseData = {
        title: title.trim(),
        content: content.trim(),
        authorId: user!.uid,
        authorNickname: userData!.nickname,
      };

      try {
        await createCase(caseData);
        setShowSuccessModal(true);
      } catch (error) {
        console.error('고민 등록 실패:', error);
        alert('고민을 등록하는 데 실패했습니다. 다시 시도해주세요.');
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const handleAdCancel = () => {
    setShowAdPopup(false);
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
        padding: '14px 20px',
        backgroundColor: 'white',
        width: '100%',
        boxSizing: 'border-box',
        borderBottom: '1px solid #F2F4F6'
      }}>
        <button
          onClick={handleBack}
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
            frameShape={Asset.frameShape.CleanW20}
            name="icon-arrow-left-mono"
            color="#191F28"
            aria-label="뒤로가기"
          />
        </button>
        <Spacing size={8} />
        <Text color="#191F28" typography="t6" fontWeight="semibold">
          글쓰기
        </Text>
      </div>

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

      {/* 가이드 팝업 - TDS Modal 사용 */}
      <Modal
        open={showGuideModal}
        onOpenChange={(open) => {
          if (!open) {
            handleGuideConfirm();
          }
        }}
      >
        <Modal.Overlay 
          onClick={handleGuideConfirm}
          className="custom-modal-overlay"
        />
        <Modal.Content>
          <div style={{ padding: '24px 24px 14px 24px', backgroundColor: 'white', borderRadius: '16px' }}>
            <Text
              display="block"
              color="#191F28ff"
              typography="t4"
              fontWeight="bold"
              style={{ marginBottom: '4px', fontSize: '20px' }}
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
            
            <div style={{ marginBottom: '10px' }}>
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
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                확인
              </button>
            </div>
          </div>
        </Modal.Content>
      </Modal>
      
      {/* TDS Modal 배경색 오버라이드 CSS */}
      <style>{`
        .custom-modal-overlay,
        [data-radix-dialog-overlay],
        [data-radix-portal] > div[data-radix-dialog-overlay] {
          background-color: rgba(0, 0, 0, 0.6) !important;
        }
      `}</style>

      {/* 성공 팝업 - TDS Modal 사용 */}
      <Modal
        open={showSuccessModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowSuccessModal(false);
            sessionStorage.removeItem('createPostFromTab');
            navigate('/', { state: { selectedTab: returnTab }, replace: true });
          }
        }}
      >
        <Modal.Overlay 
          onClick={() => {
            setShowSuccessModal(false);
            sessionStorage.removeItem('createPostFromTab');
            navigate('/', { state: { selectedTab: returnTab }, replace: true });
          }}
          className="custom-modal-overlay"
        />
        <Modal.Content>
          <div style={{ padding: '24px', backgroundColor: 'white', borderRadius: '16px' }}>
            <Text
              display="block"
              color="#191F28ff"
              typography="t4"
              fontWeight="bold"
              style={{ marginBottom: '12px', fontSize: '20px' }}
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
                  sessionStorage.removeItem('createPostFromTab');
                  navigate('/', { state: { selectedTab: returnTab }, replace: true });
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#3182F6',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                확인
              </button>
            </div>
          </div>
        </Modal.Content>
      </Modal>

      {/* 광고 안내 팝업 */}
      {showAdPopup && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
            paddingBottom: '40px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleAdCancel();
            }
          }}
        >
          <div
            style={{
              width: '352px',
              maxWidth: '90%',
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '24px',
              paddingTop: '12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 드래그 핸들 */}
            <div
              style={{
                width: '40px',
                height: '4px',
                backgroundColor: '#E5E5E5',
                borderRadius: '2px',
                marginBottom: '24px',
                marginTop: '0px'
              }}
            />

            {/* 제목 */}
            <Text color={adaptive.grey800} typography="st5" fontWeight="bold" style={{ marginBottom: '8px', textAlign: 'center', fontSize: '24px' }}>
              광고 5초보고 등록하기!
            </Text>

            {/* 이미지 */}
            <div
              style={{
                width: '282px',
                height: '246px',
                backgroundImage: `url(${missionBannerImage})`,
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                marginBottom: '24px'
              }}
            />

            <Spacing size={8} />

            {/* 등록하기 버튼 */}
            <Button
              size="large"
              display="block"
              onClick={handleAdConfirm}
              disabled={isSubmitting}
              style={{ width: '100%', marginBottom: '8px' }}
            >
              등록하기
            </Button>

            {/* 돌아가기 버튼 */}
            <button
              onClick={handleAdCancel}
              style={{ 
                width: '100%', 
                padding: '16px', 
                backgroundColor: '#F2F4F6', 
                color: '#191F28', 
                border: 'none', 
                borderRadius: '12px', 
                fontSize: '16px', 
                fontWeight: '600', 
                cursor: 'pointer' 
              }}
            >
              돌아가기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreatePostPage;
