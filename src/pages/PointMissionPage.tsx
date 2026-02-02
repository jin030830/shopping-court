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
  const [isExchanging, setIsExchanging] = useState(false);
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
    if (!user || !userData || isExchanging) return;
    
    const currentGavel = userData.points || 0;
    if (currentGavel < 50) {
      alert('판사봉이 부족합니다. (50개 필요)');
      return;
    }

    setIsExchanging(true);
    try {
      await exchangeGavel();
      alert('판사봉 50개가 토스 포인트 5원으로 교환되었습니다!');
    } catch (error: any) {
      console.error('교환 실패:', error);
      alert(error.message || '교환 중 오류가 발생했습니다.');
    } finally {
      setIsExchanging(false);
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
    buttonColor: string;
    completedColor: string;
  }) => {
    const canClaim = isUnlocked && conditionMet && !isClaimed;

    return (
      <div style={{ marginBottom: '8px', padding: '0 21px', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: '100%',
          maxWidth: '333px',
          position: 'relative'
        }}>
          {/* Level 배지와 카드 본문을 하나로 */}
          <div style={{
            width: '100%',
            borderRadius: '10px',
            overflow: 'hidden',
            boxShadow: '0px 2px 2px 0px rgba(0, 0, 0, 0.25)',
            position: 'relative'
          }}>
            {/* Level 배지 */}
            <div style={{
              width: '100%',
              height: '34px',
              background: level === 0 
                ? 'linear-gradient(120deg, #64a8ff 0%, #7e74fb 76.19%, #a02ff5 100%)'
                : level === 1 ? '#15c47e'
                : level === 2 ? '#ffb331'
                : '#f66570',
              borderRadius: '10px 10px 0 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 20px',
              position: 'relative',
              boxSizing: 'border-box'
            }}>
              <div style={{
                position: 'absolute',
                left: '20px',
                padding: '1px 4px',
                backgroundColor: level === 0 ? '#3182F628' : level === 1 ? '#02A26228' : level === 2 ? '#FFB33128' : '#F0445228',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '600',
                color: level === 0 ? '#1976D2' : level === 1 ? '#02A262' : level === 2 ? '#FFB331' : '#D32F2F'
              }}>
                Level {level}
              </div>
              {/* 제목 중앙정렬 */}
              <span style={{
                fontSize: '14px',
                fontWeight: '600',
                color: 'white',
                textAlign: 'center'
              }}>
                {title}
              </span>
            </div>

            {/* 카드 본문 - 각 레벨별 배경색 유지 */}
            <div style={{
              width: '100%',
              minHeight: 'auto',
              backgroundColor: level === 0 
                ? '#c9e2ff'
                : level === 1 ? '#aeefd5'
                : level === 2 ? '#ffefbf'
                : '#ffd4d6',
              borderRadius: '0 0 10px 10px',
              padding: '20px 70px 20px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              position: 'relative',
              boxSizing: 'border-box',
              wordBreak: 'keep-all',
              overflowWrap: 'break-word'
            }}>
              {/* 설명 */}
              <div style={{ 
                fontSize: '14px',
                fontWeight: '700',
                color: '#191F28',
                marginBottom: '4px',
                wordBreak: 'keep-all',
                overflowWrap: 'break-word'
              }}>
                {description}
              </div>

              {/* 판사봉 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#191F28'
                }}>
                  판사봉 :{' '}
                </span>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#191F28'
                }}>
                  {reward}개
                </span>
              </div>

              {/* 제한 */}
              <div style={{ 
                fontSize: '14px',
                fontWeight: '500',
                color: '#191F28'
              }}>
                {limitation}
              </div>

              {/* 받기 버튼 또는 완료 표시 */}
              <div style={{
                position: 'absolute',
                right: '20px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 100,
                pointerEvents: 'auto'
              }}>
                {isClaimed ? (
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: completedColor,
                    display: 'block'
                  }}>
                    완료 ✓
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      if (canClaim) {
                        handleClaim(
                          level === 0 ? 'firstEventMission' : 
                          level === 1 ? 'voteMission' : 
                          level === 2 ? 'commentMission' : 'hotCaseMission',
                          reward
                        );
                      }
                    }}
                    disabled={isClaiming || !canClaim}
                    style={{
                      width: '51px',
                      height: '33px',
                      backgroundColor: canClaim ? buttonColor : '#d0d5dd',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: (isClaiming || !canClaim) ? 'not-allowed' : 'pointer',
                      opacity: isClaiming ? 0.6 : 1,
                      whiteSpace: 'nowrap',
                      display: 'block'
                    }}
                  >
                    받기
                  </button>
                )}
              </div>
            </div>
          </div>
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
        padding: '0 20px',
        marginBottom: '21px',
        marginTop: '15px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: '40px'
      }}>
        {/* 왼쪽: Level 진행 중 + 2/4 + 진행바 */}
        <div style={{ 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginTop: '0px'
        }}>
          {/* Level 진행 중 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '8px'
          }}>
            <span style={{
              fontSize: '14px',
              fontWeight: '700',
              color: '#191F28'
            }}>
              Level {currentLevel}{' '}
            </span>
            <span style={{
              fontSize: '14px',
              fontWeight: '700',
              color: '#4593fc'
            }}>
              진행 중
            </span>
          </div>

          {/* 2/4 표시 - 중앙정렬 */}
          <div style={{ 
            marginBottom: '12px',
            fontSize: '20px',
            fontWeight: '700',
            color: '#191F28',
            display: 'block',
            textAlign: 'center'
          }}>
            {unlockedCount} / 4
          </div>

          {/* 진행 바 - Level 1 진행중 길이에 맞게 */}
          <div style={{
            width: '120px',
            height: '10px',
            backgroundColor: '#e5e8eb',
            borderRadius: '5px',
            overflow: 'hidden',
            marginTop: '12px'
          }}>
            <div style={{
              width: `${(unlockedCount / 4) * 100}%`,
              height: '100%',
              backgroundColor: '#4593fc',
              borderRadius: '5px',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        {/* 오른쪽: 판사봉 정보 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          marginTop: '0px'
        }}>
          <Asset.Icon
            frameShape={Asset.frameShape.CleanW40}
            backgroundColor="transparent"
            name="icon-gavel"
            aria-hidden={true}
            ratio="1/1"
          />
          {/* 정보 아이콘과 판사봉 개수 - 같은 줄에 정렬 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <div ref={infoPopupRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
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
            <span style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#191F28'
            }}>
              판사봉 {currentGavel}
            </span>
            <span style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#6b7684'
            }}>
              {' '}/ 50
            </span>
          </div>
          {/* 교환하기 버튼 - 중앙정렬 */}
          <button
            onClick={handleExchange}
            disabled={!canExchange || isExchanging}
            style={{
              padding: '0',
              backgroundColor: 'transparent',
              color: '#4593fc',
              border: 'none',
              fontSize: '14px',
              fontWeight: '700',
              cursor: (canExchange && !isExchanging) ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap',
              textDecoration: 'underline',
              opacity: (canExchange && !isExchanging) ? 1 : 0.5
            }}
          >
            {isExchanging ? '교환 중...' : '교환하기 >'}
          </button>
        </div>
      </div>

      <Spacing size={15} />
      <div style={{
        width: '100%',
        height: '1px',
        backgroundColor: adaptive.grey200
      }} />

      {/* 미션 카드들 - 옅은 회색 배경 */}
      <div style={{
        width: '100%',
        backgroundColor: '#f2f4f6',
        paddingTop: '10px',
        paddingBottom: '24px'
      }}>
        <MissionCard
          level={0}
          title="첫 이벤트"
          description="투표 1개 + 댓글 1개 + 게시물 1개"
          reward={100}
          limitation="계정당 1회 한정"
          conditionMet={level0ConditionMet}
          isUnlocked={unlockedLevels[0]}
          isClaimed={missions.firstEventMission?.claimed || false}
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
          buttonColor={adaptive.red400}
          completedColor={adaptive.red300}
        />
      </div>
    </div>
  );
}

export default PointMissionPage;