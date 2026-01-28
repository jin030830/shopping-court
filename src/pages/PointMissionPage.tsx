import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Asset } from '@toss/tds-mobile';

function PointMissionPage() {
  const navigate = useNavigate();

  // 페이지 진입 시 sessionStorage에 저장 (토스 앱의 뒤로가기 버튼 대응)
  useEffect(() => {
    sessionStorage.setItem('pointMissionFromTab', '재판 중');
  }, []);

  // 브라우저/토스 앱의 뒤로가기 버튼 처리
  useEffect(() => {
    const handlePopState = () => {
      const savedFromTab = sessionStorage.getItem('pointMissionFromTab') || '재판 중';
      navigate('/', { state: { selectedTab: savedFromTab }, replace: true });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigate]);

  return (
    <div style={{ 
      backgroundColor: 'white', 
      minHeight: '100vh',
      width: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column'
    }}>

      {/* 투표하기 3회 */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        padding: '16px 20px 8px 20px',
        gap: '12px',
        minHeight: '74px'
      }}>
        <div style={{ flexShrink: 0, marginTop: '2px' }}>
          <Asset.Icon
            frameShape={Asset.frameShape.CleanW24}
            backgroundColor="transparent"
            name="icon-vote-box-blue"
            aria-hidden={true}
            ratio="1/1"
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
          <div style={{
            color: '#191F28',
            fontSize: '17px',
            fontWeight: '700',
            lineHeight: '24px'
          }}>
            투표하기 3회
          </div>
          <div style={{
            color: '#4E5968',
            fontSize: '15px',
            fontWeight: '400',
            lineHeight: '22px'
          }}>
            게시글 재판에 참여해주세요!
          </div>
        </div>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
          width: '60px'
        }}>
          <button style={{
            padding: '6px 12px',
            backgroundColor: '#3182F6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            minWidth: '44px',
            textAlign: 'center',
            whiteSpace: 'nowrap'
          }}>
            1 P
          </button>
          <div style={{
            display: 'flex',
            gap: '4px',
            justifyContent: 'center'
          }}>
            <Asset.Icon
              frameShape={Asset.frameShape.CleanW16}
              backgroundColor="transparent"
              name="icon-check-circle-blue2-small"
              aria-hidden={true}
              ratio="1/1"
            />
            <Asset.Icon
              frameShape={Asset.frameShape.CleanW16}
              backgroundColor="transparent"
              name="icon-check-circle-blue2-small"
              aria-hidden={true}
              ratio="1/1"
            />
            <Asset.Icon
              frameShape={Asset.frameShape.CleanW16}
              backgroundColor="transparent"
              name="icon-check-circle-dark-grey"
              aria-hidden={true}
              ratio="1/1"
            />
          </div>
        </div>
      </div>

      {/* Border */}
      <div style={{
        width: 'calc(100% - 40px)',
        height: '1px',
        backgroundColor: '#E5E8EB',
        marginLeft: '20px',
        marginRight: '20px'
      }} />

      {/* 댓글 작성하기 2회 */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        padding: '8px 20px',
        gap: '12px',
        minHeight: '74px'
      }}>
        <div style={{ flexShrink: 0, marginTop: '2px' }}>
          <Asset.Icon
            frameShape={Asset.frameShape.CleanW24}
            backgroundColor="transparent"
            name="icon-open-chat-bubble"
            aria-hidden={true}
            ratio="1/1"
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
          <div style={{
            color: '#191F28',
            fontSize: '17px',
            fontWeight: '700',
            lineHeight: '24px'
          }}>
            댓글 작성하기 2회
          </div>
          <div style={{
            color: '#4E5968',
            fontSize: '15px',
            fontWeight: '400',
            lineHeight: '22px'
          }}>
            의견을 공유해주세요!
          </div>
        </div>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
          width: '60px'
        }}>
          <button style={{
            padding: '6px 12px',
            backgroundColor: '#3182F6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            minWidth: '44px',
            textAlign: 'center',
            whiteSpace: 'nowrap'
          }}>
            3 P
          </button>
          <div style={{
            display: 'flex',
            gap: '4px',
            justifyContent: 'center'
          }}>
            <Asset.Icon
              frameShape={Asset.frameShape.CleanW16}
              backgroundColor="transparent"
              name="icon-check-circle-blue2-small"
              aria-hidden={true}
              ratio="1/1"
            />
            <Asset.Icon
              frameShape={Asset.frameShape.CleanW16}
              backgroundColor="transparent"
              name="icon-check-circle-dark-grey"
              aria-hidden={true}
              ratio="1/1"
            />
          </div>
        </div>
      </div>

      {/* Border */}
      <div style={{
        width: 'calc(100% - 40px)',
        height: '1px',
        backgroundColor: '#E5E8EB',
        marginLeft: '20px',
        marginRight: '20px'
      }} />

      {/* 게시글 작성하기 */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        padding: '8px 20px',
        gap: '12px',
        minHeight: '74px'
      }}>
        <div style={{ flexShrink: 0, marginTop: '2px' }}>
          <Asset.Icon
            frameShape={Asset.frameShape.CleanW24}
            backgroundColor="transparent"
            name="icon-pencil-blue"
            aria-hidden={true}
            ratio="24/23"
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
          <div style={{
            color: '#191F28',
            fontSize: '17px',
            fontWeight: '700',
            lineHeight: '24px'
          }}>
            게시글 작성하기
          </div>
          <div style={{
            color: '#4E5968',
            fontSize: '15px',
            fontWeight: '400',
            lineHeight: '22px'
          }}>
            의견을 공유해주세요!
          </div>
        </div>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flexShrink: 0,
          width: '60px'
        }}>
          <button style={{
            padding: '6px 12px',
            backgroundColor: '#3182F6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            minWidth: '44px',
            textAlign: 'center',
            whiteSpace: 'nowrap'
          }}>
            3 P
          </button>
        </div>
      </div>

      {/* Border */}
      <div style={{
        width: 'calc(100% - 40px)',
        height: '1px',
        backgroundColor: '#E5E8EB',
        marginLeft: '20px',
        marginRight: '20px'
      }} />

      {/* 화제의 재판 기록 등재 */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        padding: '8px 20px 4px 20px',
        gap: '12px',
        minHeight: '111px'
      }}>
        <div style={{ flexShrink: 0, marginTop: '2px' }}>
          <Asset.Icon
            frameShape={Asset.frameShape.CleanW24}
            backgroundColor="transparent"
            name="icon-emoji-fire-blue"
            aria-hidden={true}
            ratio="1/1"
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
          <div style={{
            color: '#191F28',
            fontSize: '17px',
            fontWeight: '700',
            lineHeight: '24px'
          }}>
            화제의 재판 기록 등재
          </div>
          <div style={{
            color: '#4E5968',
            fontSize: '15px',
            fontWeight: '400',
            lineHeight: '22px'
          }}>
            내가 쓴 글이 화제의 재판 기록이 되면
          </div>
          <div style={{
            color: '#4E5968',
            fontSize: '15px',
            fontWeight: '400',
            lineHeight: '22px'
          }}>
            +5 포인트!
          </div>
        </div>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flexShrink: 0,
          width: '60px'
        }}>
          <button style={{
            padding: '6px 12px',
            backgroundColor: '#3182F6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            minWidth: '44px',
            textAlign: 'center',
            whiteSpace: 'nowrap'
          }}>
            5 P
          </button>
        </div>
      </div>

      {/* Border */}
      <div style={{
        width: 'calc(100% - 40px)',
        height: '1px',
        backgroundColor: '#E5E8EB',
        marginLeft: '20px',
        marginRight: '20px'
      }} />
    </div>
  );
}

export default PointMissionPage;
