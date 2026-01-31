import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Asset } from '@toss/tds-mobile';
import { useAuth } from '../hooks/useAuth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../api/firebase';
import { claimMissionReward, type UserDocument, type UserMissions, getTodayDateString } from '../api/user';
import { useTossRewardAd } from '../hooks/useTossRewardAd';

function PointMissionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [userData, setUserData] = useState<UserDocument | null>(null);
  const [loading, setLoading] = useState(true);
  
  // 리워드 광고 훅 (테스트 ID 사용)
  const { show: showRewardAd } = useTossRewardAd('ait-ad-test-rewarded-id');

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

  // 사용자 데이터 실시간 구독
  useEffect(() => {
    if (!user || !db) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setUserData(docSnap.data() as UserDocument);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  const handleClaim = (missionType: keyof UserMissions, points: number) => {
    if (!user || !userData) return;

    // 광고 보여주기
    showRewardAd(async () => {
      // 보상 획득 성공 시 (userEarnedReward) 실행
      try {
        await claimMissionReward(user.uid, missionType, points);
        // alert(`🎉 광고를 시청하고 ${points} 포인트를 받았습니다!`);
      } catch (error) {
        console.error('보상 수령 실패:', error);
        alert('보상을 받는 중 오류가 발생했습니다.');
      }
    });
  };

  const MissionItem = ({ 
    title, 
    description, 
    points, 
    current, 
    target, 
    isClaimed, 
    onClaim, 
    iconName 
  }: { 
    title: string; 
    description: string; 
    points: number; 
    current: number; 
    target: number; 
    isClaimed: boolean; 
    onClaim: () => void; 
    iconName: string;
  }) => {
    const isCompleted = current >= target;
    const canClaim = isCompleted && !isClaimed;

    return (
      <>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          padding: '16px 20px',
          gap: '12px',
          minHeight: '74px'
        }}>
          <div style={{ flexShrink: 0, marginTop: '2px' }}>
            <Asset.Icon
              frameShape={Asset.frameShape.CleanW24}
              backgroundColor="transparent"
              name={iconName}
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
              {title}
            </div>
            <div style={{
              color: '#4E5968',
              fontSize: '15px',
              fontWeight: '400',
              lineHeight: '22px'
            }}>
              {description}
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
            {isClaimed ? (
              <div style={{
                padding: '6px 12px',
                backgroundColor: '#F2F4F6',
                color: '#8B95A1',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                minWidth: '44px',
                textAlign: 'center',
                whiteSpace: 'nowrap'
              }}>
                완료
              </div>
            ) : canClaim ? (
              <button 
                onClick={onClaim}
                style={{
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
                  whiteSpace: 'nowrap',
                  animation: 'pulse 2s infinite'
                }}
              >
                {points} P
              </button>
            ) : (
              <button disabled style={{
                padding: '6px 12px',
                backgroundColor: '#E5E8EB',
                color: '#B0B8C1',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'not-allowed',
                minWidth: '44px',
                textAlign: 'center',
                whiteSpace: 'nowrap'
              }}>
                {points} P
              </button>
            )}

            {/* 진행도 아이콘 (목표가 1회보다 큰 경우에만 표시) */}
            {target > 1 && (
              <div style={{
                display: 'flex',
                gap: '4px',
                justifyContent: 'center'
              }}>
                {Array.from({ length: target }).map((_, i) => (
                  <Asset.Icon
                    key={i}
                    frameShape={Asset.frameShape.CleanW16}
                    backgroundColor="transparent"
                    name={isClaimed || i < current ? "icon-check-circle-blue2-small" : "icon-check-circle-dark-grey"}
                    aria-hidden={true}
                    ratio="1/1"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{
          width: 'calc(100% - 40px)',
          height: '1px',
          backgroundColor: '#E5E8EB',
          marginLeft: '20px',
          marginRight: '20px'
        }} />
      </>
    );
  };

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>로딩 중...</div>;
  }

  // 데이터 처리 로직 (일일 미션 초기화 반영)
  const today = getTodayDateString();
  const rawStats = userData?.stats || { voteCount: 0, commentCount: 0, postCount: 0, hotCaseCount: 0, lastActiveDate: '' };
  
  // 날짜가 지났으면 화면상에서는 0으로 초기화해서 보여줌
  // (실제 DB 초기화는 사용자가 활동을 하거나 보상을 받을 때 이루어짐)
  const isTodayStats = rawStats.lastActiveDate === today;
  
  const stats = isTodayStats ? rawStats : { 
    voteCount: 0, 
    commentCount: 0, 
    postCount: 0, 
    hotCaseCount: 0, 
    lastActiveDate: today 
  };

  // 미션 상태도 날짜가 지났으면 초기화된 상태로 보여줌
  const rawMissions = userData?.missions || { 
    voteMission: { claimed: false }, 
    commentMission: { claimed: false }, 
    postMission: { claimed: false }, 
    hotCaseMission: { claimed: false } 
  };

  // 각 미션별로 lastClaimedDate 체크 (없으면 초기화된 것으로 간주)
  // 단, 여기서는 stats 날짜가 다르면 미션도 다 초기화된 것으로 보여주는 게 깔끔함
  const missions = isTodayStats ? rawMissions : {
    voteMission: { claimed: false },
    commentMission: { claimed: false },
    postMission: { claimed: false },
    hotCaseMission: { claimed: false }
  };

  return (
    <div style={{ 
      backgroundColor: 'white', 
      minHeight: '100vh',
      width: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(49, 130, 246, 0.7); }
          70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(49, 130, 246, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(49, 130, 246, 0); }
        }
      `}</style>

      {/* 헤더 영역 제거됨 */}
      <div style={{
        width: '100%',
        height: '12px',
        backgroundColor: '#F8F9FA'
      }} />

      {/* 투표하기 3회 */}
      <MissionItem 
        title="투표하기 3회"
        description="게시글 재판에 참여해주세요!"
        points={1}
        current={stats.voteCount}
        target={3}
        isClaimed={missions.voteMission?.claimed ?? false}
        onClaim={() => handleClaim('voteMission', 1)}
        iconName="icon-vote-box-blue"
      />

      {/* 댓글 작성하기 2회 */}
      <MissionItem 
        title="댓글 작성하기 2회"
        description="의견을 공유해주세요!"
        points={3}
        current={stats.commentCount}
        target={2}
        isClaimed={missions.commentMission?.claimed ?? false}
        onClaim={() => handleClaim('commentMission', 3)}
        iconName="icon-open-chat-bubble"
      />

      {/* 게시글 작성하기 */}
      <MissionItem 
        title="게시글 작성하기"
        description="새로운 고민을 올려보세요!"
        points={3}
        current={stats.postCount}
        target={1}
        isClaimed={missions.postMission?.claimed ?? false}
        onClaim={() => handleClaim('postMission', 3)}
        iconName="icon-pencil-blue"
      />

      {/* 화제의 재판 기록 등재 */}
      <MissionItem 
        title="화제의 재판 기록 등재"
        description="내가 쓴 글이 화제가 되면 +5P!"
        points={5}
        current={stats.hotCaseCount}
        target={1}
        isClaimed={missions.hotCaseMission?.claimed ?? false}
        onClaim={() => handleClaim('hotCaseMission', 5)}
        iconName="icon-emoji-fire-blue"
      />

    </div>
  );
}

export default PointMissionPage;

