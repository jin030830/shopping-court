import { Asset, Text } from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';

function PointMissionPage() {

  return (
    <div style={{ 
      backgroundColor: 'white', 
      minHeight: '100vh',
      width: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Mission List */}
      <div style={{ flex: 1, padding: '0' }}>
        {/* 투표하기 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid #E5E5E5'
        }}>
          <Asset.Icon
            frameShape={Asset.frameShape.CleanW24}
            backgroundColor="transparent"
            name="icon-vote-box-blue"
            aria-hidden={true}
          />
          <div style={{ flex: 1, marginLeft: '12px' }}>
            <Text
              display="block"
              color={adaptive.grey700}
              typography="t6"
              fontWeight="bold"
              style={{ marginBottom: '4px' }}
            >
              투표하기
            </Text>
            <Text
              display="block"
              color={adaptive.grey600}
              typography="t7"
              fontWeight="regular"
            >
              게시글에 재판 투표를 해주세요!
            </Text>
          </div>
          <button style={{
            padding: '8px 16px',
            backgroundColor: '#3182F6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer'
          }}>
            포인트 1원
          </button>
        </div>

        {/* 댓글 작성하기 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid #E5E5E5'
        }}>
          <Asset.Icon
            frameShape={Asset.frameShape.CleanW24}
            backgroundColor="transparent"
            name="icon-open-chat"
            aria-hidden={true}
          />
          <div style={{ flex: 1, marginLeft: '12px' }}>
            <Text
              display="block"
              color={adaptive.grey700}
              typography="t6"
              fontWeight="bold"
              style={{ marginBottom: '4px' }}
            >
              댓글 작성하기
            </Text>
            <Text
              display="block"
              color={adaptive.grey600}
              typography="t7"
              fontWeight="regular"
            >
              의견을 공유해주세요!
            </Text>
          </div>
          <button style={{
            padding: '8px 16px',
            backgroundColor: '#3182F6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer'
          }}>
            포인트 3원
          </button>
        </div>

        {/* 게시글 작성하기 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid #E5E5E5'
        }}>
          <Asset.Icon
            frameShape={Asset.frameShape.CleanW24}
            backgroundColor="transparent"
            name="icon-pencil-blue"
            aria-hidden={true}
          />
          <div style={{ flex: 1, marginLeft: '12px' }}>
            <Text
              display="block"
              color={adaptive.grey700}
              typography="t6"
              fontWeight="bold"
              style={{ marginBottom: '4px' }}
            >
              게시글 작성하기
            </Text>
            <Text
              display="block"
              color={adaptive.grey600}
              typography="t7"
              fontWeight="regular"
            >
              고민을 공유해보세요!
            </Text>
          </div>
          <button style={{
            padding: '8px 16px',
            backgroundColor: '#3182F6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer'
          }}>
            포인트 3원
          </button>
        </div>

        {/* HOT 게시판 등록 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid #E5E5E5'
        }}>
          <Asset.Icon
            frameShape={Asset.frameShape.CleanW24}
            backgroundColor="transparent"
            name="icon-emoji-fire-blue"
            aria-hidden={true}
          />
          <div style={{ flex: 1, marginLeft: '12px' }}>
            <Text
              display="block"
              color={adaptive.grey700}
              typography="t6"
              fontWeight="bold"
              style={{ marginBottom: '4px' }}
            >
              HOT 게시판 등록
            </Text>
            <Text
              display="block"
              color={adaptive.grey600}
              typography="t7"
              fontWeight="regular"
            >
              본인의 게시물이 인기 게시물이 되면 +5포인트!
            </Text>
          </div>
          <button style={{
            padding: '8px 16px',
            backgroundColor: '#3182F6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer'
          }}>
            포인트 5원
          </button>
        </div>
      </div>
    </div>
  );
}

export default PointMissionPage;
