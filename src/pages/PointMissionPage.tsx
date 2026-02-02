import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
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
    sessionStorage.setItem('pointMissionFromTab', '재판 중');
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const savedFromTab = sessionStorage.getItem('pointMissionFromTab') || '재판 중';
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

  const unlockedCount = [isLevel0Claimed, isLevel1Claimed, isLevel2Claimed, isLevel3Claimed].filter(Boolean).length;
  const currentLevel = unlockedCount; 

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

  const MissionCard = ({ level, title, description, reward, limitation, conditionMet, isClaimed, buttonColor, completedColor, missionType }: any) => {
    const canClaim = conditionMet && !isClaimed;
    const animationName = level === 0 ? 'pulse-blue' : level === 1 ? 'pulse-green' : level === 2 ? 'pulse-orange' : 'pulse-red';

    return (
      <div style={{ marginBottom: '8px', padding: '0 21px', display: 'flex', justifyContent: 'center' }}>
        <style>{pulseKeyframes}</style>
        <div style={{ width: '100%', maxWidth: '333px', position: 'relative' }}>
          <div style={{ width: '100%', borderRadius: '10px', overflow: 'hidden', boxShadow: '0px 2px 2px 0px rgba(0, 0, 0, 0.25)', position: 'relative' }}>
            <div style={{ width: '100%', height: '34px', background: level === 0 ? 'linear-gradient(120deg, #64a8ff 0%, #7e74fb 76.19%, #a02ff5 100%)' : level === 1 ? '#15c47e' : level === 2 ? '#ffb331' : '#f66570', borderRadius: '10px 10px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px', position: 'relative', boxSizing: 'border-box' }}>
              <div style={{ position: 'absolute', left: '20px', padding: '1px 4px', backgroundColor: level === 0 ? '#3182F628' : level === 1 ? '#02A26228' : level === 2 ? '#FFB33128' : '#F0445228', borderRadius: '4px', fontSize: '12px', fontWeight: '600', color: level === 0 ? '#1976D2' : level === 1 ? '#02A262' : level === 2 ? '#FFB331' : '#D32F2F' }}>Level {level}</div>
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'white', textAlign: 'center' }}>{title}</span>
            </div>
            <div style={{ width: '100%', minHeight: 'auto', backgroundColor: level === 0 ? '#c9e2ff' : level === 1 ? '#aeefd5' : level === 2 ? '#ffefbf' : '#ffd4d6', borderRadius: '0 0 10px 10px', padding: '20px 70px 20px 20px', display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative', boxSizing: 'border-box', wordBreak: 'keep-all', overflowWrap: 'break-word' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#191F28', marginBottom: '4px', wordBreak: 'keep-all', overflowWrap: 'break-word' }}>{description}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#191F28' }}>판사봉 : </span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#191F28' }}>{reward}개</span>
              </div>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#191F28' }}>{limitation}</div>
              <div style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', zIndex: 100, pointerEvents: 'auto' }}>
                {isClaimed ? (
                  <span style={{ fontSize: '14px', fontWeight: '700', color: completedColor, display: 'block' }}>완료 ✓</span>
                ) : (
                  <button
                    onClick={() => { if (canClaim) handleClaim(missionType, reward); }}
                    disabled={isClaiming || !canClaim}
                    style={{ width: '51px', height: '33px', backgroundColor: canClaim ? buttonColor : '#d0d5dd', color: 'white', border: 'none', borderRadius: '5px', fontSize: '13px', fontWeight: '600', cursor: (isClaiming || !canClaim) ? 'not-allowed' : 'pointer', opacity: isClaiming ? 0.6 : 1, whiteSpace: 'nowrap', display: 'block', animation: canClaim ? `${animationName} 2s infinite` : 'none', transformOrigin: 'center' }}
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
    <div style={{ backgroundColor: 'white', minHeight: '100vh', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', paddingBottom: '24px' }}>
      <Spacing size={29} />
      <div style={{ padding: '0 20px', marginBottom: '21px', marginTop: '15px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: '40px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '0px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#191F28' }}>Level {currentLevel} </span>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#4593fc' }}>진행 중</span>
          </div>
          <div style={{ marginBottom: '12px', fontSize: '20px', fontWeight: '700', color: '#191F28', display: 'block', textAlign: 'center' }}>{unlockedCount} / 4</div>
          <div style={{ width: '120px', height: '10px', backgroundColor: '#e5e8eb', borderRadius: '5px', overflow: 'hidden', marginTop: '12px' }}>
            <div style={{ width: `${(unlockedCount / 4) * 100}%`, height: '100%', backgroundColor: '#4593fc', borderRadius: '5px', transition: 'width 0.3s ease' }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginTop: '0px' }}>
          <Asset.Icon frameShape={Asset.frameShape.CleanW40} backgroundColor="transparent" name="icon-gavel" aria-hidden={true} ratio="1/1" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div ref={infoPopupRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Asset.Icon frameShape={Asset.frameShape.CleanW16} backgroundColor="transparent" name="icon-info-circle-mono-16" aria-hidden={true} ratio="1/1" onClick={() => setShowInfoPopup(!showInfoPopup)} style={{ cursor: 'pointer' }} />
              {showInfoPopup && (
                <div style={{ position: 'absolute', top: '24px', right: '0', backgroundColor: 'white', padding: '12px', borderRadius: '8px', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.15)', zIndex: 1000, minWidth: '200px' }}>
                  <Text color={adaptive.grey900} typography="t7" fontWeight="medium">판사봉 50개 모으면 5P 교환 가능!</Text>
                  <button onClick={() => setShowInfoPopup(false)} style={{ marginTop: '8px', padding: '4px 8px', backgroundColor: adaptive.blue500, color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>확인</button>
                </div>
              )}
            </div>
            <span style={{ fontSize: '18px', fontWeight: '700', color: '#191F28' }}>판사봉 {currentGavel}</span>
            <span style={{ fontSize: '18px', fontWeight: '700', color: '#6b7684' }}> / 50</span>
          </div>
          <button onClick={handleExchange} disabled={!canExchange || isExchanging} style={{ padding: '0', backgroundColor: 'transparent', color: '#4593fc', border: 'none', fontSize: '14px', fontWeight: '700', cursor: (canExchange && !isExchanging) ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap', textDecoration: 'underline', opacity: (canExchange && !isExchanging) ? 1 : 0.5 }}>{isExchanging ? '교환 중...' : '교환하기 >'}</button>
        </div>
      </div>
      <Spacing size={15} />
      <div style={{ width: '100%', height: '1px', backgroundColor: adaptive.grey200 }} />
      <div style={{ width: '100%', backgroundColor: '#f2f4f6', paddingTop: '10px', paddingBottom: '24px' }}>
        <MissionCard level={0} title="첫 이벤트" description="투표 1개 + 댓글 1개 + 게시물 1개" reward={100} limitation="계정당 1회 한정" conditionMet={level0ConditionMet} isClaimed={isLevel0Claimed} buttonColor={adaptive.blue400} completedColor={adaptive.blue300} missionType="LEVEL_0" />
        <MissionCard level={1} title="초보 미션" description="투표 5개" reward={30} limitation="하루 1번" conditionMet={level1ConditionMet} isClaimed={isLevel1Claimed} buttonColor={adaptive.green500} completedColor={adaptive.green300} missionType="LEVEL_1" />
        <MissionCard level={2} title="참여 미션" description="댓글 3개" reward={60} limitation="하루 1번" conditionMet={level2ConditionMet} isClaimed={isLevel2Claimed} buttonColor={adaptive.orange400} completedColor={adaptive.orange300} missionType="LEVEL_2" />
        <MissionCard level={3} title="핵심 기여" description="화제의 재판 기록에 오르기" reward={100} limitation="게시물당 1번" conditionMet={level3ConditionMet} isClaimed={isLevel3Claimed} buttonColor={adaptive.red400} completedColor={adaptive.red300} missionType="LEVEL_3" />
      </div>
    </div>
  );
}

export default PointMissionPage;