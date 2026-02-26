import { useLocation, useNavigate } from 'react-router-dom';
import { Asset, Text } from '@toss/tds-mobile';

type TabKey = 'home' | 'write' | 'myPosts' | 'mission';

function getActiveTab(pathname: string): TabKey {
  if (pathname.startsWith('/create-post')) return 'write';
  if (pathname.startsWith('/my-posts')) return 'myPosts';
  if (pathname.startsWith('/point-mission')) return 'mission';
  // 나머지는 모두 홈으로 간주 (재판 중 / HOT / 재판 완료 포함)
  return 'home';
}

interface BottomTabItemProps {
  active: boolean;
  iconName: string;
  label: string;
  onClick: () => void;
}

function BottomTabItem({ active, iconName, label, onClick }: BottomTabItemProps) {
  const iconColor = active ? '#191F28' : '#9E9E9E'; // Changed to pure grey
  const textColor = active ? '#191F28' : '#9E9E9E'; // Changed to pure grey

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        background: 'none',
        border: 'none',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        cursor: 'pointer',
      }}
    >
      <Asset.Icon
        frameShape={Asset.frameShape.CleanW24}
        name={iconName}
        color={iconColor}
        aria-hidden={true}
      />
      <Text
        display="block"
        color={textColor}
        typography="st13"
        fontWeight="medium"
        textAlign="center"
        style={{ fontSize: '10px' }}
      >
        {label}
      </Text>
    </button>
  );
}

export default function BottomTabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  if (location.pathname.startsWith('/create-post')) return null;

  const active = getActiveTab(location.pathname);

  const goHome = () => {
    navigate('/', { state: { selectedTab: '재판 중' }, replace: false });
  };

  const goWrite = () => {
    navigate('/create-post', { state: { fromTab: '재판 중' } });
  };

  const goMyPosts = () => {
    navigate('/my-posts', { state: { fromTab: '재판 중' } });
  };

  const goMission = () => {
    navigate('/point-mission', { state: { fromTab: '재판 중' } });
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 16,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          padding: '0 0 8px 0',
          boxSizing: 'border-box',
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            margin: '0 12px',
            backgroundColor: 'white',
            borderRadius: 30,
            padding: 9,
            boxShadow:
              '0px 20px 20px -16px #191F2911, 0px 40px 200px 0px #191F293f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <BottomTabItem
            active={active === 'home'}
            iconName="icon-home-mono"
            label="홈"
            onClick={goHome}
          />
          <BottomTabItem
            active={active === 'write'}
            iconName="icon-plus-mono"
            label="글쓰기"
            onClick={goWrite}
          />
          <BottomTabItem
            active={active === 'myPosts'}
            iconName="icon-user-mono"
            label="내가 쓴 글"
            onClick={goMyPosts}
          />
          <BottomTabItem
            active={active === 'mission'}
            iconName="icon-point-collect-mono"
            label="포인트 미션"
            onClick={goMission}
          />
        </div>
      </div>
    </div>
  );
}

