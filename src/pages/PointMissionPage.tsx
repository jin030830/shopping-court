import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { Asset, Text, Spacing } from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { useAuth } from '../hooks/useAuth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../api/firebase';
import { claimMissionReward, exchangeGavel, type UserDocument, type UserMissions, getTodayDateString } from '../api/user';
import { getAllCases, type CaseDocument } from '../api/cases';
import { useTossRewardAd } from '../hooks/useTossRewardAd';

function PointMissionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [userData, setUserData] = useState<UserDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const [hotCases, setHotCases] = useState<CaseDocument[]>([]);
  const infoPopupRef = useRef<HTMLDivElement>(null);
  
  const { show: showRewardAd } = useTossRewardAd('ait-ad-test-rewarded-id');

  // 페이지 진입 시 sessionStorage에 저장
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

  // 정보 팝업 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (infoPopupRef.current && !infoPopupRef.current.contains(event.target as Node)) {
        setShowInfoPopup(false);
      }
    };

    if (showInfoPopup) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showInfoPopup]);

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

  // 화제의 재판 기록 확인
  useEffect(() => {
    const checkHotCases = async () => {
      if (!user) return;
      try {
        const cases = await getAllCases();
        const hotCompletedCases = cases.filter(
          caseItem => 
            caseItem.status === 'CLOSED' && 
            caseItem.hotScore > 0 && 
            caseItem.authorId === user.uid
        );
        setHotCases(hotCompletedCases);
      } catch (error) {
        console.error('화제의 재판 기록 조회 실패:', error);
      }
    };
    checkHotCases();
  }, [user]);

  const handleClaim = (missionType: keyof UserMissions, gavel: number) => {
    if (!user || !userData || isClaiming) return;

    setIsClaiming(true);

    showRewardAd(async () => {
      try {
        await claimMissionReward(user.uid, missionType, gavel);
      } catch (error) {
        console.error('보상 수령 실패:', error);
        alert('보상을 받는 중 오류가 발생했습니다.');
      } finally {
        setIsClaiming(false);
      }
    });
  };

  const handleExchange = async () => {
    if (!user || !userData) return;
    
    const currentGavel = userData.points || 0;
    if (currentGavel < 50) {
      alert('판사봉이 부족합니다. (50개 필요)');
      return;
    }

    try {
      await exchangeGavel(user.uid);
    } catch (error: any) {
      console.error('교환 실패:', error);
      alert(error.message || '교환 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>로딩 중...</div>;
  }

  const today = getTodayDateString();
  const rawStats = userData?.stats || { voteCount: 0, commentCount: 0, postCount: 0, hotCaseCount: 0, lastActiveDate: '' };
  const isTodayStats = rawStats.lastActiveDate === today;
  
  const stats = isTodayStats ? rawStats : { 
    voteCount: 0, 
    commentCount: 0, 
    postCount: 0, 
    hotCaseCount: 0, 
    lastActiveDate: today 
  };

  const rawMissions = userData?.missions || { 
    firstEventMission: { claimed: false }, 
    voteMission: { claimed: false }, 
    commentMission: { claimed: false }, 
    hotCaseMission: { claimed: false } 
  };

  const missions = isTodayStats ? rawMissions : {
    firstEventMission: rawMissions.firstEventMission,
    voteMission: { claimed: false },
    commentMission: { claimed: false },
    hotCaseMission: { claimed: false }
  };

  // 미션 해금 상태 계산
  const level0Completed = missions.firstEventMission?.claimed || false;
  const level1Completed = missions.voteMission?.claimed || false;
  const level2Completed = missions.commentMission?.claimed || false;
  
  const unlockedLevels = [
    true,
    true,
    level0Completed && level1Completed,
    level2Completed,
  ];
  
  const unlockedCount = unlockedLevels.filter(Boolean).length;
  const currentLevel = unlockedCount > 0 ? unlockedCount - 1 : 0;

  // Level 0 조건 확인
  const level0ConditionMet = stats.voteCount >= 1 && stats.commentCount >= 1 && stats.postCount >= 1;
  const level1ConditionMet = stats.voteCount >= 5;
  const level2ConditionMet = stats.commentCount >= 3;
  const level3ConditionMet = hotCases.length > 0;

  const currentGavel = userData?.points || 0;
  const canExchange = currentGavel >= 50;

  // 미션 카드 컴포넌트
  const MissionCard = ({ 
    level, 
    title, 
    description, 
    reward, 
    limitation, 
    conditionMet, 
    isUnlocked, 
    isClaimed, 
    unlockCondition,
    bgColor,
    buttonColor,
    completedColor
  }: {
    level: number;
    title: string;
    description: string;
    reward: number;
    limitation: string;
    conditionMet: boolean;
    isUnlocked: boolean;
    isClaimed: boolean;
    unlockCondition?: string;
    bgColor: string;
    buttonColor: string;
    completedColor: string;
  }) => {
    const canClaim = isUnlocked && conditionMet && !isClaimed;

    return (
      <div style={{ marginBottom: '64px', padding: '0 21px' }}>
        <div style={{
          width: '100%',
          maxWidth: '333px',
          margin: '0 auto',
          position: 'relative',
          opacity: isUnlocked ? 1 : 0.6
        }}>
          {/* Level 배지 */}
          <div style={{
            width: '100%',
            height: '34px',
            background: level === 0 
              ? 'linear-gradient(120deg, #64a8ff 0%, #7e74fb 76.19%, #a02ff5 100%)'
              : level === 1 ? adaptive.green400
              : level === 2 ? adaptive.yellow600
              : adaptive.red400,
            borderRadius: '10px',
            boxShadow: '0px 0px 2px 0px rgba(0, 0, 0, 0.25)',
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px'
          }}>
            <div style={{
              padding: '1px 4px',
              backgroundColor: level === 0 ? '#3182F628' : level === 1 ? '#02A26228' : level === 2 ? '#FFB33128' : '#F0445228',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '600',
              color: level === 0 ? '#1976D2' : level === 1 ? '#02A262' : level === 2 ? '#FFB331' : '#D32F2F'
            }}>
              Level {level}
            </div>
            <Text
              display="block"
              color="adaptive-card-bg-white"
              typography="t6"
              fontWeight="semibold"
            >
              {title}
            </Text>
          </div>

          {/* 카드 본문 */}
          <div style={{
            width: '100%',
            minHeight: '102px',
            backgroundColor: bgColor,
            borderRadius: '10px',
            padding: '20px',
            boxShadow: '0px 2px 2px 0px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            position: 'relative'
          }}>
            {/* 설명 */}
            <Text color={adaptive.grey700} typography="t6" fontWeight="bold" style={{ marginBottom: '4px' }}>
              {description}
            </Text>

            {/* 판사봉 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
              <Text color={adaptive.grey700} typography="t6" fontWeight="medium">
                판사봉 :{' '}
              </Text>
              <Text color={adaptive.grey700} typography="t6" fontWeight="bold">
                {reward}개
              </Text>
            </div>

            {/* 제한 */}
            <Text color={adaptive.grey700} typography="t6" fontWeight="medium" style={{ marginBottom: '8px' }}>
              {limitation}
            </Text>

            {/* 받기 버튼 또는 완료 표시 */}
            <div style={{
              position: 'absolute',
              right: '20px',
              top: '20px'
            }}>
              {isClaimed ? (
                <Text
                  display="block"
                  color={completedColor}
                  typography="t6"
                  fontWeight="bold"
                  textAlign="right"
                >
                  완료 ✓
                </Text>
              ) : canClaim ? (
                <button
                  onClick={() => handleClaim(
                    level === 0 ? 'firstEventMission' : 
                    level === 1 ? 'voteMission' : 
                    level === 2 ? 'commentMission' : 'hotCaseMission',
                    reward
                  )}
                  disabled={isClaiming}
                  style={{
                    width: '51px',
                    height: '33px',
                    backgroundColor: buttonColor,
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: isClaiming ? 'not-allowed' : 'pointer',
                    opacity: isClaiming ? 0.6 : 1,
                    whiteSpace: 'nowrap'
                  }}
                >
                  받기
                </button>
              ) : (
                <button
                  disabled
                  style={{
                    width: '51px',
                    height: '33px',
                    backgroundColor: '#8b95a1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'not-allowed',
                    opacity: 0.6,
                    whiteSpace: 'nowrap'
                  }}
                >
                  받기
                </button>
              )}
            </div>
          </div>

          {/* 잠금 오버레이 */}
          {!isUnlocked && (
            <div style={{
              position: 'absolute',
              top: '34px',
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(139, 149, 161, 0.6)',
              borderRadius: '10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <Asset.Icon
                frameShape={Asset.frameShape.CleanW40}
                backgroundColor="transparent"
                name="icon-lock-mono"
                color={adaptive.grey100}
                aria-hidden={true}
                ratio="1/1"
              />
              <Text
                display="block"
                color={adaptive.grey100}
                typography="t5"
                fontWeight="bold"
                textAlign="center"
              >
                {unlockCondition}
              </Text>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ 
      backgroundColor: 'white', 
      minHeight: '100vh',
      width: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      paddingBottom: '24px'
    }}>
      <Spacing size={29} />

      {/* 진행도 및 판사봉 */}
      <div style={{
        padding: '0 30px',
        marginBottom: '21px'
      }}>
        {/* Level 진행 중 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px'
        }}>
          <Text color={adaptive.grey700} typography="t6" fontWeight="bold">
            Level {currentLevel}{' '}
          </Text>
          <Text color={adaptive.blue400} typography="t6" fontWeight="bold">
            진행 중
          </Text>
        </div>

        {/* 2/4 표시 */}
        <Text color={adaptive.grey700} typography="t4" fontWeight="bold" style={{ marginBottom: '21px' }}>
          {unlockedCount} / 4
        </Text>

        {/* 진행 바 */}
        <div style={{
          width: '100%',
          height: '8px',
          backgroundColor: adaptive.grey200,
          borderRadius: '4px',
          marginBottom: '21px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${(unlockedCount / 4) * 100}%`,
            height: '100%',
            backgroundColor: adaptive.blue500,
            transition: 'width 0.3s ease'
          }} />
        </div>

        {/* 판사봉 정보 */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          justifyContent: 'flex-end',
          position: 'relative',
          marginTop: '21px'
        }}>
          <Asset.Icon
            frameShape={Asset.frameShape.CleanW40}
            backgroundColor="transparent"
            name="icon-gavel"
            aria-hidden={true}
            ratio="1/1"
          />
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '4px',
            position: 'relative'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <div ref={infoPopupRef} style={{ position: 'relative' }}>
                <Asset.Icon
                  frameShape={Asset.frameShape.CleanW16}
                  backgroundColor="transparent"
                  name="icon-info-circle-mono-16"
                  aria-hidden={true}
                  ratio="1/1"
                  onClick={() => setShowInfoPopup(!showInfoPopup)}
                  style={{ cursor: 'pointer' }}
                />
                {showInfoPopup && (
                  <div style={{
                    position: 'absolute',
                    top: '24px',
                    right: '0',
                    backgroundColor: 'white',
                    padding: '12px',
                    borderRadius: '8px',
                    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.15)',
                    zIndex: 1000,
                    minWidth: '200px'
                  }}>
                    <Text color={adaptive.grey900} typography="t7" fontWeight="medium">
                      판사봉 50개 모으면 5P 교환 가능!
                    </Text>
                    <button
                      onClick={() => setShowInfoPopup(false)}
                      style={{
                        marginTop: '8px',
                        padding: '4px 8px',
                        backgroundColor: adaptive.blue500,
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      확인
                    </button>
                  </div>
                )}
              </div>
              <Text
                display="block"
                color={adaptive.grey800}
                typography="t5"
                fontWeight="bold"
                textAlign="right"
              >
                판사봉 {currentGavel}
              </Text>
              <Text
                display="block"
                color={adaptive.grey600}
                typography="t5"
                fontWeight="bold"
                textAlign="center"
              >
                / 50
              </Text>
            </div>
            {/* 교환하기 버튼 */}
            <button
              onClick={handleExchange}
              disabled={!canExchange}
              style={{
                padding: '4px 8px',
                backgroundColor: canExchange ? adaptive.blue500 : adaptive.grey300,
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: canExchange ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap'
              }}
            >
              교환하기 &gt;
            </button>
          </div>
        </div>
      </div>

      <Spacing size={15} />
      <div style={{
        width: '100%',
        height: '1px',
        backgroundColor: adaptive.grey200
      }} />
      <Spacing size={19} />

      {/* 미션 카드들 */}
      <MissionCard
        level={0}
        title="첫 이벤트"
        description="투표 1개 + 댓글 1개 + 게시물 1개"
        reward={100}
        limitation="계정당 1회 한정"
        conditionMet={level0ConditionMet}
        isUnlocked={unlockedLevels[0]}
        isClaimed={missions.firstEventMission?.claimed || false}
        bgColor={adaptive.blue100}
        buttonColor={adaptive.blue400}
        completedColor={adaptive.blue300}
      />

      <MissionCard
        level={1}
        title="초보 미션"
        description="투표 5개"
        reward={30}
        limitation="하루 1번"
        conditionMet={level1ConditionMet}
        isUnlocked={unlockedLevels[1]}
        isClaimed={missions.voteMission?.claimed || false}
        bgColor={adaptive.green100}
        buttonColor={adaptive.green500}
        completedColor={adaptive.green300}
      />

      <MissionCard
        level={2}
        title="참여 미션"
        description="댓글 3개"
        reward={60}
        limitation="하루 1번"
        conditionMet={level2ConditionMet}
        isUnlocked={unlockedLevels[2]}
        isClaimed={missions.commentMission?.claimed || false}
        unlockCondition="Level 1 완료 시 해금"
        bgColor={adaptive.yellow100}
        buttonColor={adaptive.orange400}
        completedColor={adaptive.orange300}
      />

      <MissionCard
        level={3}
        title="핵심 기여"
        description="화제의 재판 기록에 오르기"
        reward={100}
        limitation="게시물당 1번"
        conditionMet={level3ConditionMet}
        isUnlocked={unlockedLevels[3]}
        isClaimed={missions.hotCaseMission?.claimed || false}
        unlockCondition="Level 2 완료 시 해금"
        bgColor={adaptive.red100}
        buttonColor={adaptive.red400}
        completedColor={adaptive.red300}
      />
    </div>
  );
}

export default PointMissionPage;
