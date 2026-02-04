import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef, type CSSProperties } from 'react';
import { Asset, Text, Spacing } from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { useAuth } from '../hooks/useAuth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../api/firebase';
import { claimMissionReward, exchangeGavel, type UserDocument } from '../api/user';
import { getAllCases, type CaseDocument } from '../api/cases';
import { useTossRewardAd } from '../hooks/useTossRewardAd';

function PointMissionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [userData, setUserData] = useState<UserDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isExchanging, setIsExchanging] = useState(false);
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const [hotCases, setHotCases] = useState<CaseDocument[]>([]);
  const [myPostCount, setMyPostCount] = useState(0);
  const infoPopupRef = useRef<HTMLDivElement>(null);
  
  const { show: showRewardAd } = useTossRewardAd('ait-ad-test-rewarded-id');

  useEffect(() => {
    const fromTab =
      (location.state as any)?.fromTab ||
      sessionStorage.getItem('pointMissionFromTab') ||
      'HOT 게시판';
    sessionStorage.setItem('pointMissionFromTab', fromTab);
  }, [location.state]);

  useEffect(() => {
    const handlePopState = () => {
      const savedFromTab = sessionStorage.getItem('pointMissionFromTab') || 'HOT 게시판';
      navigate('/', { state: { selectedTab: savedFromTab }, replace: true });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigate]);

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

  useEffect(() => {
    const checkCases = async () => {
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
        
        const myCases = cases.filter(caseItem => caseItem.authorId === user.uid);
        setMyPostCount(myCases.length);
      } catch (error) {
        console.error('재판 기록 조회 실패:', error);
      }
    };
    checkCases();
  }, [user]);

  const handleClaim = (missionType: string, gavel: number) => {
    if (!user || !userData || isClaiming) return;
    setIsClaiming(true);
    showRewardAd(async () => {
      try {
        await claimMissionReward(user.uid, missionType, gavel);
      } catch (error: any) {
        console.error('보상 수령 실패:', error);
        alert(error.message || '보상을 받는 중 오류가 발생했습니다.');
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

  const dailyStats = userData?.dailyStats || { 
    voteCount: 0, 
    commentCount: 0, 
    isLevel1Claimed: false, 
    isLevel2Claimed: false, 
    lastActiveDate: '' 
  };

  const totalStats = userData?.totalStats || { voteCount: 0, commentCount: 0, postCount: 0 };

  const isLevel0Claimed = userData?.isLevel0Claimed || false;
  const isLevel1Claimed = dailyStats.isLevel1Claimed;
  const isLevel2Claimed = dailyStats.isLevel2Claimed;
  const isLevel3Claimed = userData?.missions?.hotCaseMission?.claimed || false; 

  const level0ConditionMet = 
    (totalStats.voteCount >= 1 || dailyStats.voteCount >= 1) && 
    (totalStats.commentCount >= 1 || dailyStats.commentCount >= 1) && 
    (totalStats.postCount >= 1 || myPostCount >= 1);

  const level1ConditionMet = dailyStats.voteCount >= 5;
  const level2ConditionMet = dailyStats.commentCount >= 3;
  const level3ConditionMet = hotCases.length > 0 || (userData?.stats?.hotCaseCount || 0) > 0;

  const currentGavel = userData?.points || 0;
  const canExchange = currentGavel >= 50;

  const pulseKeyframes = `
    @keyframes pulse-blue { 0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); } 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); } }
    @keyframes pulse-green { 0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); } 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); } }
    @keyframes pulse-orange { 0% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(249, 115, 22, 0); } 100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); } }
    @keyframes pulse-red { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
  `;

  const MissionCard = ({ level, title, description, reward, limitation, conditionMet, isClaimed, missionType, buttonText }: any) => {
    const canClaim = conditionMet && !isClaimed;
    const animationName = level === 0 ? 'pulse-blue' : level === 1 ? 'pulse-green' : level === 2 ? 'pulse-orange' : 'pulse-red';
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
        // 정보 아이콘의 위치 계산
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
          {/* 말풍선 - 최상위 컨테이너에 렌더링 */}
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
              {/* 말풍선 꼬리 - 정보 아이콘을 가리키도록 오른쪽에 위치 */}
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
          <div style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', boxShadow: '0px 0px 2px 0px rgba(0, 0, 0, 0.25)', border: '1px solid #C9A86A', position: 'relative', backgroundColor: '#F7F3EE', padding: '4px' }}>
            <div style={{ width: '100%', borderRadius: '10px', boxShadow: 'inset 0 0 0 1px #C9A86A', backgroundColor: '#F7F3EE', padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: '2px', position: 'relative', boxSizing: 'border-box' }}>
              {/* 제목과 정보 아이콘 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0px' }}>
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
              
              {/* 설명 */}
              <Text color="#4F2810" typography="t7" fontWeight="regular" style={{ fontSize: '13px', lineHeight: '1.4', marginBottom: '0px' }}>
                {description}
              </Text>
              
              {/* 조건 */}
              <Text color={adaptive.grey800} typography="t6" fontWeight="bold" style={{ fontSize: '14px', marginBottom: '0px' }}>
                {limitation}
              </Text>
              
              {/* 보상 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: 'auto' }}>
                <Text color={adaptive.grey700} typography="t7" fontWeight="medium" style={{ fontSize: '13px' }}>
                  보상 :{' '}
                </Text>
                <Text color={adaptive.grey700} typography="t7" fontWeight="bold" style={{ fontSize: '13px' }}>
                  판사봉 {reward}개
                </Text>
              </div>
              
              {/* 버튼 - 오른쪽 아래 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0px', justifyContent: 'flex-end', marginTop: 'auto' }}>
                {(() => {
                  const claimedLabel =
                    missionType === 'LEVEL_0'
                      ? '✓ 등록 완료'
                      : missionType === 'LEVEL_3'
                        ? '✓ 등재 완료'
                        : '✓ 제출 완료';

                  // 공통 버튼 스타일
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

                  // 완료 상태 (세 번째 사진처럼)
                  if (isClaimed) {
                    return (
                      <button
                        aria-disabled={true}
                        style={{
                          ...baseButtonStyle,
                          backgroundColor: '#8C6B57',
                          color: '#ffffff',
                          WebkitTextFillColor: '#ffffff',
                          cursor: 'default',
                          opacity: 1,
                          pointerEvents: 'none',
                        }}
                      >
                        {claimedLabel}
                      </button>
                    );
                  }

                  // 활성 상태 (첫 번째 사진처럼)
                  if (canClaim) {
                    return (
                      <button
                        onClick={() => handleClaim(missionType, reward)}
                        disabled={isClaiming}
                        style={{
                          ...baseButtonStyle,
                          background: 'linear-gradient(120deg, #3a2e25 0%, #8c6b57 100%)',
                          color: '#ffffff',
                          WebkitTextFillColor: '#ffffff',
                          cursor: isClaiming ? 'not-allowed' : 'pointer',
                          opacity: isClaiming ? 0.6 : 1,
                          animation: `${animationName} 2s infinite`,
                        }}
                      >
                        {buttonText || '받기'}
                      </button>
                    );
                  }

                  // 잠금 상태 (기존 회색 잠금 버튼)
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
  };

  return (
    <div style={{ backgroundColor: 'white', minHeight: '100vh', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', paddingBottom: '24px', paddingLeft: '0', paddingRight: '0' }}>
      <Spacing size={10} />
      <div style={{ padding: '10px 10px 5px 10px', backgroundColor: '#FCF8F2', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ padding: '0 10px', marginBottom: '11px', textAlign: 'center' }}>
          <Text color={adaptive.grey800} typography="t4" fontWeight="bold" style={{ fontSize: '20px' }}>
            오늘의 판결 업무
          </Text>
        </div>
        <div style={{ width: '100%', height: '1px', backgroundColor: '#ccb284', opacity: 0.6, marginBottom: '11px' }} />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '0 10px', marginBottom: '10px', gap: '80px' }}>
          {/* 왼쪽: 판사봉 정보 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '11px', alignItems: 'center', marginTop: '8px' }}>
            <Asset.Icon frameShape={Asset.frameShape.CleanW40} backgroundColor="transparent" name="icon-gavel" aria-hidden={true} ratio="1/1" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Text display="block" color={adaptive.grey800} typography="t5" fontWeight="bold">
                판사봉 {currentGavel}
              </Text>
              <Text display="block" color={adaptive.grey600} typography="t5" fontWeight="bold">
                / 50
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
                    {/* 말풍선 꼬리 */}
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
            <button 
              onClick={handleExchange} 
              disabled={!canExchange || isExchanging} 
              style={{ 
                padding: '0', 
                backgroundColor: 'transparent', 
                color: adaptive.blue500, 
                border: 'none', 
                fontSize: '14px', 
                fontWeight: '700', 
                cursor: (canExchange && !isExchanging) ? 'pointer' : 'not-allowed', 
                whiteSpace: 'nowrap', 
                textAlign: 'center',
                opacity: (canExchange && !isExchanging) ? 1 : 0.5 
              }}
            >
              {isExchanging ? '교환 중...' : '교환하기 >'}
            </button>
          </div>
          
          {/* 오른쪽: 진행 현황 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center', marginTop: '12px', marginLeft: '-20px' }}>
            <Text color="#6B7684" typography="t7" fontWeight="medium" style={{ marginBottom: '4px' }}>
              진행 현황
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Text color="#6B7684" typography="t6" fontWeight="bold">✓ 투표 </Text>
                <Text color="#3182F6" typography="t6" fontWeight="bold">{dailyStats.voteCount}</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Text color="#6B7684" typography="t6" fontWeight="bold">✓ 댓글 </Text>
                <Text color="#3182F6" typography="t6" fontWeight="bold">{dailyStats.commentCount}</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Text color="#6B7684" typography="t6" fontWeight="bold">✓ 게시물 </Text>
                <Text color="#3182F6" typography="t6" fontWeight="bold">{myPostCount}</Text>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div style={{ width: '100%', backgroundColor: 'white', paddingTop: '8px', paddingBottom: '24px', paddingLeft: '10px', paddingRight: '10px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <MissionCard level={0} title="첫 이벤트" description="첫 사건에 참여해 배심원으로 공식 등록해보세요" reward={100} limitation="투표 1회 + 댓글 1개 + 게시물 1개" conditionMet={level0ConditionMet} isClaimed={isLevel0Claimed} missionType="LEVEL_0" buttonText="배심원 등록" />
        <MissionCard level={1} title="일반 사건 심리" description="소비 사건을 살펴보고 당신의 판단을 투표로 남겨주세요" reward={30} limitation="투표 5회" conditionMet={level1ConditionMet} isClaimed={isLevel1Claimed} missionType="LEVEL_1" buttonText="판결 제출하기" />
        <MissionCard level={2} title="판결 사유 제출" description="판결 이유를 댓글로 남겨 사건 해결을 도와주세요" reward={60} limitation="댓글 3회" conditionMet={level2ConditionMet} isClaimed={isLevel2Claimed} missionType="LEVEL_2" buttonText="의견 제출하기" />
        <MissionCard level={3} title="핵심 기여 사건" description="많은 시민이 주목하는 재판 기록의 주인공이 되어보세요" reward={100} limitation="'화제의 재판 기록'에 등재" conditionMet={level3ConditionMet} isClaimed={isLevel3Claimed} missionType="LEVEL_3" buttonText="화제의 주인공" />
      </div>
    </div>
  );
}

export default PointMissionPage;