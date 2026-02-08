import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback, memo, type CSSProperties } from 'react';
import { Asset, Text, Spacing, Button, TextButton } from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { graniteEvent } from '@apps-in-toss/web-framework';
import { useAuth } from '../hooks/useAuth';
import { 
  claimMissionReward, 
  exchangeGavel, 
  warmUpExchangeGavel, 
  warmUpClaimMissionReward, 
  getUserData, 
  type UserDocument, 
  getTodayDateString 
} from '../api/user';
import { getUnclaimedHotCases, type CaseDocument } from '../api/cases';
import { useTossRewardAd } from '../hooks/useTossRewardAd';
import missionBannerImage from '../assets/missionbanner.jpeg';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const pulseKeyframes = `
  @keyframes pulse-gold { 0% { box-shadow: 0 0 0 0 rgba(140, 107, 87, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(140, 107, 87, 0); } 100% { box-shadow: 0 0 0 0 rgba(140, 107, 87, 0); } }
`;

interface MissionCardProps {
  level: number;
  title: string;
  description: string;
  reward: number;
  limitation: string;
  conditionMet: boolean;
  isClaimed: boolean;
  missionType: string;
  buttonText?: string;
  onClaim: (missionType: string, reward: number) => void;
  isClaiming: boolean;
  unclaimedCount?: number;
}

const MissionCard = memo(({ 
  level, title, description, reward, limitation, conditionMet, isClaimed, missionType, buttonText, onClaim, isClaiming, unclaimedCount 
}: MissionCardProps) => {
  const canClaim = conditionMet && !isClaimed;
  const animationName = 'pulse-gold';
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const infoPopupRef = useRef<HTMLDivElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0, right: 0 });
  
  const infoMessages: { [key: number]: string } = {
    0: '계정당 1회만 가능',
    1: '하루 1회 제한',
    2: '하루 1회 제한',
    3: '게시물당 1개 지급'
  };
  
  const infoMessage = infoMessages[level] || '';
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (infoPopupRef.current && !infoPopupRef.current.contains(event.target as Node)) {
        setShowInfoPopup(false);
      }
    };
    if (showInfoPopup) {
      document.addEventListener('mousedown', handleClickOutside);
      if (infoPopupRef.current) {
        const rect = infoPopupRef.current.getBoundingClientRect();
        const parentRect = infoPopupRef.current.closest('[data-mission-card]')?.getBoundingClientRect();
        if (parentRect) {
          setTooltipPosition({
            top: rect.top - parentRect.top - 8,
            left: rect.left - parentRect.left + rect.width / 2,
            right: parentRect.right - rect.right
          });
        }
      }
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showInfoPopup]);

  return (
    <div style={{ marginBottom: '12px', padding: '0', display: 'flex', justifyContent: 'center', width: '100%', boxSizing: 'border-box', marginLeft: '0', marginRight: '0' }}>
      <style>{pulseKeyframes}</style>
      <div data-mission-card style={{ width: '100%', maxWidth: '333px', position: 'relative', margin: '0 auto', marginLeft: '14px'}}>
        {showInfoPopup && (
          <div style={{ 
            position: 'absolute', 
            right: `${tooltipPosition.right - 8}px`,
            top: `${tooltipPosition.top + 4}px`,
            transform: 'translateY(-100%)',
            marginTop: '-8px',
            backgroundColor: 'white', 
            padding: '8px 12px', 
            borderRadius: '8px', 
            boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.15)', 
            zIndex: 1002, 
            whiteSpace: 'nowrap',
            fontSize: '13px',
            color: '#191F28',
            display: 'inline-block',
            lineHeight: '1.4'
          }}>
            <Text color="#191F28" typography="t7" fontWeight="medium" style={{ fontSize: '13px', whiteSpace: 'nowrap', display: 'inline' }}>
              {infoMessage}
            </Text>
            <div style={{
              position: 'absolute',
              bottom: '-6px',
              right: '12px',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid white'
            }} />
          </div>
        )}
        <div style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', boxShadow: '0px 0px 2px 0px rgba(0, 0, 0, 0.25)', border: '1px solid #C9A86A', position: 'relative', backgroundColor: '#F7F3EE', padding: '2px' }}>
          <div style={{ width: '100%', borderRadius: '10px', boxShadow: 'inset 0 0 0 1px #C9A86A', backgroundColor: '#F7F3EE', padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: '0px', position: 'relative', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0px', marginTop: '4px' }}>
              <Text display="block" color="#3A2E25" typography="st8" fontWeight="bold" style={{ fontSize: '18px' }}>
                {title}
              </Text>
              <div ref={infoPopupRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <div 
                  onClick={() => setShowInfoPopup(!showInfoPopup)} 
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Asset.Icon
                    frameShape={Asset.frameShape.CleanW16}
                    backgroundColor="transparent"
                    name="icon-info-circle-mono"
                    color="#c9a86bcc"
                    aria-hidden={true}
                    ratio="1/1"
                  />
                </div>
              </div>
            </div>
            
            <Text color="#4F2810" typography="t7" fontWeight="regular" style={{ fontSize: '13px', lineHeight: '1.4', marginBottom: '8px' }}>
              {description}
            </Text>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', marginBottom: 'auto' }}>
              <Text color={adaptive.grey800} typography="t6" fontWeight="bold" style={{ fontSize: '16px', marginBottom: '0px' }}>
                {limitation}
              </Text>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Text color={adaptive.grey700} typography="t7" fontWeight="medium" style={{ fontSize: '15px' }}>
                  보상 :{' '}
                </Text>
                <Text color={adaptive.grey700} typography="t7" fontWeight="bold" style={{ fontSize: '15px' }}>
                  판사봉 {reward}개
                </Text>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0px', justifyContent: 'flex-end', marginTop: 'auto' }}>
              {(() => {
                const claimedLabel =
                  missionType === 'LEVEL_0'
                    ? '✓ 등록 완료'
                    : missionType === 'LEVEL_3'
                      ? '✓ 등재 완료'
                      : '✓ 제출 완료';

                const baseButtonStyle: CSSProperties = {
                  minWidth: '131px',
                  height: '27px',
                  border: 'none',
                  borderRadius: '5px',
                  fontSize: '13px',
                  fontWeight: 400,
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '0 12px',
                  transformOrigin: 'center',
                };

                if (isClaimed && missionType !== 'LEVEL_3') {
                  return (
                    <button
                      aria-disabled={true}
                      style={{
                        ...baseButtonStyle,
                        backgroundColor: '#8C6B57',
                        color: '#ffffff',
                        cursor: 'default',
                        opacity: 1,
                        pointerEvents: 'none',
                      }}
                    >
                      {claimedLabel}
                    </button>
                  );
                }

                if (canClaim) {
                  const finalButtonText = missionType === 'LEVEL_3' && unclaimedCount && unclaimedCount > 0 
                    ? `화제의 주인공 [${unclaimedCount}]` 
                    : buttonText || '받기';

                  return (
                    <button
                      onClick={() => onClaim(missionType, reward)}
                      disabled={isClaiming}
                      style={{
                        ...baseButtonStyle,
                        background: 'linear-gradient(120deg, #3a2e25 0%, #8c6b57 100%)',
                        color: '#ffffff',
                        cursor: isClaiming ? 'not-allowed' : 'pointer',
                        opacity: isClaiming ? 0.6 : 1,
                        animation: `${animationName} 2s infinite`,
                      }}
                    >
                      {finalButtonText}
                    </button>
                  );
                }

                return (
                  <button
                    disabled={true}
                    style={{
                      ...baseButtonStyle,
                      backgroundColor: '#6B7684',
                      color: '#9E9E9E',
                      cursor: 'not-allowed',
                      opacity: 1,
                    }}
                  >
                    <Asset.Icon
                      frameShape={Asset.frameShape.CleanW16}
                      backgroundColor="transparent"
                      name="icon-lock-mono"
                      color="#9E9E9E"
                      aria-hidden={true}
                      ratio="1/1"
                    />
                    {buttonText || '받기'}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

function PointMissionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const isSupported = graniteEvent?.addEventListener != null;
    if (!isSupported) return;

    let isSubscribed = true;
    const unsubscribe = graniteEvent.addEventListener("backEvent", {
      onEvent: () => {
        if (!isSubscribed) return;
        isSubscribed = false;
        unsubscribe();
        navigate("/", { replace: true });
      },
    });

    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [navigate]);

  const { data: userData, isInitialLoading: isUserLoading } = useQuery<UserDocument | null, Error>({
    queryKey: ['user', user?.uid],
    queryFn: () => user ? getUserData(user) : null,
    enabled: !!user,
    staleTime: 1000 * 60 * 30, // 30분간 캐시 유지 (재진입 시 즉시 표시)
    gcTime: 1000 * 60 * 60,    // 1시간 동안 메모리에 캐시 유지
  });

  const [isClaiming, setIsClaiming] = useState(false);
  const [isExchanging, setIsExchanging] = useState(false);
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const [hotCases, setHotCases] = useState<CaseDocument[]>([]);
  const infoPopupRef = useRef<HTMLDivElement>(null);
  const [showRewardPopup, setShowRewardPopup] = useState(false);
  const [pendingMission, setPendingMission] = useState<{ missionType: string; gavel: number } | null>(null);
  
  const { show: showRewardAd } = useTossRewardAd('ait.v2.live.ad43dc8f10064218');
  const [today, setToday] = useState(getTodayDateString());

  // 페이지 진입 시 Warm-up 시도
  useEffect(() => {
    if (user) {
      warmUpExchangeGavel();
      warmUpClaimMissionReward();
    }
  }, [user]);

  // 페이지 진입 시 sessionStorage에 저장
  useEffect(() => {
    const fromTab =
      (location.state as any)?.fromTab ||
      sessionStorage.getItem('pointMissionFromTab') ||
      'HOT 게시판';
    sessionStorage.setItem('pointMissionFromTab', fromTab);
  }, [location.state]);

  // 자정 경계 처리
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const newToday = getTodayDateString();
        if (newToday !== today) {
          setToday(newToday);
          queryClient.invalidateQueries({ queryKey: ['user', user?.uid] });
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [today, user?.uid, queryClient]);

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

  // 화제의 재판 기록 확인 함수 (최적화 버전)
  const checkHotCases = useCallback(async () => {
    if (!user) return;
    try {
      const unclaimedCases = await getUnclaimedHotCases(user.uid);
      setHotCases(unclaimedCases);
    } catch (error) {
      console.error('화제의 재판 기록 조회 실패:', error);
    }
  }, [user]);

  useEffect(() => {
    checkHotCases();
  }, [checkHotCases]);

  const handleClaim = useCallback(async (missionType: string, gavel: number) => {
    if (!user || !userData || isClaiming) return;
    setPendingMission({ missionType, gavel });
    setShowRewardPopup(true);
  }, [user, userData, isClaiming]);

  const handleRewardConfirm = async () => {
    if (!user || !userData || !pendingMission || isClaiming) return;

    setIsClaiming(true);
    setShowRewardPopup(false);

    showRewardAd(async () => {
      try {
        await claimMissionReward(user.uid, pendingMission.missionType, pendingMission.gavel);
        
        queryClient.setQueryData(['user', user.uid], (prev: UserDocument | undefined) => {
          if (!prev) return prev;
          const newUserData = { ...prev };
          newUserData.points = (newUserData.points || 0) + pendingMission.gavel;
          if (pendingMission.missionType === 'LEVEL_0') {
            newUserData.isLevel0Claimed = true;
          } else if (pendingMission.missionType === 'LEVEL_1') {
            newUserData.dailyStats = { ...newUserData.dailyStats, isLevel1Claimed: true };
          } else if (pendingMission.missionType === 'LEVEL_2') {
            newUserData.dailyStats = { ...newUserData.dailyStats, isLevel2Claimed: true };
          }
          return newUserData;
        });

        queryClient.invalidateQueries({ queryKey: ['user', user.uid] });

        if (pendingMission.missionType === 'LEVEL_3') {
          await checkHotCases();
        }
      } catch (error) {
        console.error('보상 수령 실패:', error);
        alert('보상을 받는 중 오류가 발생했어요.');
      } finally {
        setIsClaiming(false);
        setPendingMission(null);
      }
    });
  };

  const handleRewardCancel = () => {
    setShowRewardPopup(false);
    setPendingMission(null);
  };

  const handleExchange = async () => {
    if (!user || !userData || isExchanging) return;
    
    const currentGavel = userData.points || 0;
    if (currentGavel < 50) {
      return;
    }

    setIsExchanging(true);
    try {
      await exchangeGavel();
      queryClient.invalidateQueries({ queryKey: ['user', user?.uid] });
    } catch (error: any) {
      console.error('교환 실패:', error);
    } finally {
      setIsExchanging(false);
    }
  };

  if (isUserLoading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>로딩 중...</div>;
  }

  const rawDailyStats = userData?.dailyStats || { voteCount: 0, commentCount: 0, postCount: 0, lastActiveDate: today, isLevel1Claimed: false, isLevel2Claimed: false };
  const isDateMismatched = rawDailyStats.lastActiveDate !== today;

  const displayDailyStats = isDateMismatched ? {
    voteCount: 0,
    commentCount: 0,
    postCount: 0,
    isLevel1Claimed: false,
    isLevel2Claimed: false,
    lastActiveDate: today
  } : rawDailyStats;
  
  const myPostCount = displayDailyStats.postCount || 0;
  const isLevel0Claimed = userData?.isLevel0Claimed || false;
  const isLevel1Claimed = displayDailyStats.isLevel1Claimed;
  const isLevel2Claimed = displayDailyStats.isLevel2Claimed;

  const level0ConditionMet = displayDailyStats.voteCount >= 1 && displayDailyStats.commentCount >= 1 && displayDailyStats.postCount >= 1;
  const level1ConditionMet = displayDailyStats.voteCount >= 5;
  const level2ConditionMet = displayDailyStats.commentCount >= 3;
  
  const unclaimedHotCases = hotCases;
  const level3ConditionMet = unclaimedHotCases.length > 0;
  const isLevel3Claimed = false;

  const currentGavel = userData?.points || 0;
  const canExchange = currentGavel >= 50;

  return (
    <div style={{ backgroundColor: 'white', minHeight: '100vh', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', paddingBottom: '24px', paddingLeft: '0', paddingRight: '0' }}>
      <Spacing size={10} />
      <div style={{ padding: '10px 10px 5px 10px', backgroundColor: 'white', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ padding: '0 10px', marginBottom: '11px', textAlign: 'center' }}>
          <Text color={adaptive.grey800} typography="t4" fontWeight="bold" style={{ fontSize: '20px' }}>
            오늘의 판결 업무
          </Text>
        </div>
        <div style={{ width: 'calc(100% - 40px)', height: '1px', backgroundColor: '#ccb284', opacity: 0.6, marginBottom: '11px', marginLeft: 'auto', marginRight: 'auto' }} />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '0 10px', marginBottom: '10px', gap: '80px' }}>
          {/* 왼쪽: 판사봉 정보 (develop 반영) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '11px', alignItems: 'center', marginTop: '8px', justifyContent: 'flex-start' }}>
            <Asset.Icon frameShape={{ width: 48, height: 48 }} backgroundColor="transparent" name="icon-gavel" aria-hidden={true} ratio="1/1" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Text display="inline" color={adaptive.grey800} typography="t5" fontWeight="bold" style={{ fontSize: '18px' }}>
                판사봉 {currentGavel}
              </Text>
              <div ref={infoPopupRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <div 
                  onClick={() => setShowInfoPopup(!showInfoPopup)} 
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Asset.Icon frameShape={{ width: 11, height: 11 }} backgroundColor="transparent" name="icon-info-circle-mono-16" aria-hidden={true} ratio="1/1" />
                </div>
                {showInfoPopup && (
                  <div style={{ 
                    position: 'absolute', 
                    left: '50%',
                    bottom: '100%',
                    transform: 'translateX(-50%)',
                    marginBottom: '8px',
                    backgroundColor: 'white', 
                    padding: '8px 12px', 
                    borderRadius: '8px', 
                    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.15)', 
                    zIndex: 1000, 
                    whiteSpace: 'nowrap',
                    fontSize: '13px',
                    color: '#191F28',
                    display: 'inline-block',
                    lineHeight: '1.4'
                  }}>
                    <Text color="#191F28" typography="t7" fontWeight="medium" style={{ fontSize: '13px', whiteSpace: 'nowrap', display: 'inline' }}>
                      50개 모으면 5P 교환 가능
                    </Text>
                    <div style={{
                      position: 'absolute',
                      bottom: '-6px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 0,
                      height: 0,
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      borderTop: '6px solid white'
                    }} />
                  </div>
                )}
              </div>
            </div>
            <TextButton
              variant="arrow"
              color={canExchange ? adaptive.blue500 : adaptive.grey600}
              size="small"
              onClick={handleExchange}
              disabled={!canExchange || isExchanging}
              style={{ marginTop: '-6px' }}
            >
              {isExchanging ? '교환 중...' : '교환하기'}
            </TextButton>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center', marginTop: '12px', marginLeft: '-20px' }}>
            <Text color="#6B7684" typography="t7" fontWeight="medium" style={{ marginBottom: '4px' }}>
              진행 현황
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Text color={adaptive.grey800} typography="t6" fontWeight="bold">✓ 투표 </Text>
                <Text color="#3182F6" typography="t6" fontWeight="bold">{displayDailyStats.voteCount}</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Text color={adaptive.grey800} typography="t6" fontWeight="bold">✓ 댓글 </Text>
                <Text color="#3182F6" typography="t6" fontWeight="bold">{displayDailyStats.commentCount}</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Text color={adaptive.grey800} typography="t6" fontWeight="bold">✓ 게시물 </Text>
                <Text color="#3182F6" typography="t6" fontWeight="bold">{myPostCount}</Text>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div style={{ width: '100%', backgroundColor: 'white', paddingTop: '8px', paddingBottom: '24px', paddingLeft: '10px', paddingRight: '10px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <MissionCard level={0} title="첫 이벤트" description="첫 사건에 참여해 배심원으로 공식 등록해보세요" reward={100} limitation="투표 1회 + 댓글 1개 + 게시물 1개" conditionMet={level0ConditionMet} isClaimed={isLevel0Claimed} missionType="LEVEL_0" buttonText="배심원 등록" onClaim={handleClaim} isClaiming={isClaiming} />
        <MissionCard level={1} title="일반 사건 심리" description="소비 사건을 살펴보고 당신의 판단을 투표로 남겨주세요" reward={30} limitation="투표 5회" conditionMet={level1ConditionMet} isClaimed={isLevel1Claimed} missionType="LEVEL_1" buttonText="판결 제출하기" onClaim={handleClaim} isClaiming={isClaiming} />
        <MissionCard level={2} title="판결 사유 제출" description="판결 이유를 댓글로 남겨 사건 해결을 도와주세요" reward={60} limitation="댓글 3회" conditionMet={level2ConditionMet} isClaimed={isLevel2Claimed} missionType="LEVEL_2" buttonText="의견 제출하기" onClaim={handleClaim} isClaiming={isClaiming} />
        <MissionCard level={3} title="핵심 기여 사건" description="많은 시민이 주목하는 재판 기록의 주인공이 되어보세요" reward={100} limitation="'화제의 재판 기록'에 등재" conditionMet={level3ConditionMet} isClaimed={isLevel3Claimed} missionType="LEVEL_3" buttonText="화제의 주인공" onClaim={handleClaim} isClaiming={isClaiming} unclaimedCount={unclaimedHotCases.length} />
      </div>

      {/* 리워드 팝업 (develop 반영 + 최적화 유지) */}
      {showRewardPopup && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            zIndex: 10000, padding: '20px', paddingBottom: '40px'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) handleRewardCancel(); }}
        >
          <div
            style={{
              width: '352px', maxWidth: '90%', backgroundColor: 'white', borderRadius: '20px',
              padding: '24px', paddingTop: '12px', display: 'flex', flexDirection: 'column',
              alignItems: 'center', position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: '40px', height: '4px', backgroundColor: '#E5E5E5', borderRadius: '2px', marginBottom: '24px', marginTop: '0px' }} />
            <Text color={adaptive.grey800} typography="st5" fontWeight="bold" style={{ marginBottom: '18px', textAlign: 'center', fontSize: '24px' }}>광고 보고 포인트 받기!</Text>
            <div style={{ width: '282px', height: '246px', backgroundImage: `url(${missionBannerImage})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', marginBottom: '24px' }} />
            <Spacing size={8} />
            <Button size="large" display="block" onClick={handleRewardConfirm} disabled={isClaiming} style={{ width: '100%', marginBottom: '8px' }}>포인트 받기</Button>
            {/* 돌아가기 버튼 (develop 스타일 반영) */}
            <button
              onClick={handleRewardCancel}
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

export default PointMissionPage;