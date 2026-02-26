import { useNavigate, useLocation, useNavigationType } from 'react-router-dom';
import { Asset, Text, Spacing } from '@toss/tds-mobile';
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { getCasesPaginated, getHotCases, type CaseDocument } from '../api/cases';
import { Timestamp } from 'firebase/firestore';
import { adaptive } from '@toss/tds-colors';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { caseKeys } from '../constants/queryKeys';
import BottomTabBar from '../components/BottomTabBar';
import { useAuth } from '../hooks/useAuth';

// 상대 시간 포맷팅 함수 (X일 전 / X시간 전)
const formatTimeAgo = (timestamp: Timestamp): string => {
  const now = new Date();
  const then = timestamp.toDate();
  const diffMs = now.getTime() - then.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays >= 1) {
    return `${diffDays}일 전`;
  }

  const hours = Math.max(1, diffHours);
  return `${hours}시간 전`;
};

// 게시물 아이템 컴포넌트 (재판 중 리스트용)
const CaseItem = memo(({ post, selectedTab, navigate }: any) => {
  const viewCount = post.viewCount || ((post.guiltyCount || 0) + (post.innocentCount || 0));
  return (
    <div onClick={() => navigate(`/case/${post.id}`, { state: { fromTab: selectedTab } })}
      style={{ backgroundColor: 'white', padding: '16px 20px', borderBottom: '1px solid #F0F0F0', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
        <Text display="block" color="#191F28" typography="t4" fontWeight="bold" style={{ flex: 1, textAlign: 'left', WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: '18px' }}>{post.title}</Text>
        {selectedTab === '재판 중' && post.createdAt && <Text color="#9E9E9E" typography="st13" fontWeight="regular" style={{ fontSize: '13px', flexShrink: 0 }}>{formatTimeAgo(post.createdAt)}</Text>}
      </div>
      <div style={{
        marginBottom: '12px',
        lineHeight: '1.4',
        color: '#666666',
        fontSize: '14px',
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
        {post.content}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text color="#9E9E9E" typography="st13" fontWeight="medium" style={{ fontSize: '13px' }}>
          조회수 {viewCount}
        </Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Asset.Icon frameShape={{ width: 14, height: 14 }} backgroundColor="transparent" name="icon-chat-bubble-grayline-mono" color="#9E9E9E" aria-hidden={true} ratio="1/1" />
          <Text color="#9E9E9E" typography="st13" fontWeight="medium" style={{ fontSize: '13px' }}>{post.commentCount ?? 0}</Text>
        </div>
      </div>
    </div>
  );
});

// HOT 게시판 카드 컴포넌트
const HotCardItem = memo(({ post, index, navigate }: any) => {
  const totalVotes = (post.guiltyCount || 0) + (post.innocentCount || 0);
  const commentCount = post.commentCount ?? 0;
  const viewCount = post.viewCount ?? 0;
  const createdAtLabel = post.createdAt ? formatTimeAgo(post.createdAt) : '';

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '0 10px', marginTop: index === 0 ? 24 : 32 }}>
      <div
        onClick={() => navigate(`/case/${post.id}`, { state: { fromTab: 'HOT 게시판' } })}
        style={{
          width: '100%',
          maxWidth: 340,
          backgroundColor: '#F7F3EE',
          borderRadius: 10,
          boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
          padding: '18px 18px 16px 18px',
          boxSizing: 'border-box',
          cursor: 'pointer'
        }}
      >
        {/* TOP 라벨 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <Asset.Icon
            frameShape={Asset.frameShape.CleanW20}
            backgroundColor="transparent"
            name="icon-emoji-fire"
            aria-hidden={true}
            ratio="1/1"
          />
          <Text display="block" color={adaptive.red500} typography="t6" fontWeight="bold">
            TOP {index + 1}
          </Text>
        </div>

        {/* 피고인 / 시간 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Asset.Image
              frameShape={Asset.frameShape.CleanW20}
              backgroundColor="transparent"
              src="https://static.toss.im/ml-product/tosst-inapp_tdvjdh3nb4l5yg4xp9a734u4.png"
              aria-hidden={true}
              style={{ aspectRatio: '1/1' }}
            />
            <Text color="#666666" typography="t7" fontWeight="regular" style={{ fontSize: '13px' }}>
              피고인 {post.authorNickname?.replace(/^배심원/, '') ?? '익명'}님
            </Text>
          </div>
          {createdAtLabel && (
            <Text color="#666666" typography="st13" fontWeight="regular" style={{ fontSize: '13px' }}>
              {createdAtLabel}
            </Text>
          )}
        </div>

        {/* 제목 */}
        <Text
          display="block"
          color={adaptive.grey800}
          typography="t4"
          fontWeight="bold"
          textAlign="center"
          style={{ marginBottom: '6px', fontSize: '18px' }}
        >
          {post.title}
        </Text>

        {/* 본문 (전체 표시) */}
        <Text
          display="block"
          color={adaptive.grey700}
          typography="t6"
          fontWeight="regular"
          style={{ marginBottom: '12px', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}
        >
          {post.content}
        </Text>

        {/* 조회수 / 댓글 (본문 영역 하단, 어두운 배경 쪽) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <Text color="#9E9E9E" typography="st13" fontWeight="medium" style={{ fontSize: '13px' }}>
            조회수 {viewCount || totalVotes}
          </Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Asset.Icon
              frameShape={{ width: 13, height: 13 }}
              backgroundColor="transparent"
              name="icon-chat-bubble-grayline-mono"
              color="#9E9E9E"
              aria-hidden={true}
              ratio="1/1"
            />
            <Text color="#9E9E9E" typography="st13" fontWeight="medium" style={{ fontSize: '13px' }}>
              {commentCount}
            </Text>
          </div>
        </div>

        {/* 하단 영역 (밝은 배경: 재판 참여하기) */}
        <div
          style={{
            marginLeft: -18,
            marginRight: -18,
            marginBottom: -16,
            marginTop: 6,
            padding: '10px 18px 12px 18px',
            backgroundColor: '#FFFBF7',
            borderTop: '1px solid #E5D7C7',
            borderBottomLeftRadius: 10,
            borderBottomRightRadius: 10,
          }}
        >
          {/* 재판 참여하기 CTA */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <Text
              display="block"
              color={adaptive.grey800}
              typography="t5"
              fontWeight="bold"
              textAlign="center"
            >
              재판 참여하기
            </Text>
            <Asset.Icon
              frameShape={Asset.frameShape.CleanW16}
              backgroundColor="transparent"
              name="icon-arrow-right-textbutton-mono"
              color={adaptive.grey800}
              aria-hidden={true}
              ratio="1/1"
            />
          </div>
        </div>
      </div>
    </div>
  );
});



function HomePage({ defaultTab }: { defaultTab?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const { userData } = useAuth();

  const [selectedTab, setSelectedTab] = useState(() => {
    // 0. 프롭스로 전달된 기본 탭 (Deep Link 대응)
    if (defaultTab) return defaultTab;

    // 1. location.state에서 전달된 탭 (다른 페이지에서 돌아올 때)
    const stateTab = (location.state as any)?.selectedTab;
    if (stateTab) return stateTab;

    // 2. sessionStorage에서 임시 저장된 탭 (뒤로가기 대응)
    const tempTab = sessionStorage.getItem('caseDetailFromTab') || sessionStorage.getItem('completedListFromTab') || sessionStorage.getItem('pointMissionFromTab') || sessionStorage.getItem('createPostFromTab') || sessionStorage.getItem('myPostsFromTab');
    if (tempTab) return tempTab;

    // 3. localStorage에서 마지막 선택된 탭 (새로고침 대응)
    const lastTab = localStorage.getItem('lastSelectedTab');
    if (lastTab && ['재판 중', 'HOT 게시판', '재판 완료'].includes(lastTab)) {
      return lastTab;
    }

    // 4. 기본값
    return 'HOT 게시판';
  });

  // Infinite Query for '재판 중'
  const {
    data: openCasesData,
    fetchNextPage: fetchNextOpenCases,
    hasNextPage: hasMoreOpenCases,
    isFetchingNextPage: isFetchingNextOpenCases,
    isLoading: isLoadingOpenCases,
    error: openCasesError
  } = useInfiniteQuery<{ cases: CaseDocument[], lastDoc: any }, Error>({
    queryKey: caseKeys.list('OPEN'),
    queryFn: ({ pageParam }) => getCasesPaginated({ status: 'OPEN', limitCount: 10, lastVisible: pageParam }),
    getNextPageParam: (lastPage) => lastPage.cases.length === 10 ? lastPage.lastDoc : undefined,
    initialPageParam: null,
    enabled: selectedTab === '재판 중',
    staleTime: 1000 * 10,
    refetchInterval: 60000,
    refetchOnWindowFocus: true, // [Optimization] 화면 복귀 시 즉시 최신화
  });

  // Query for 'HOT 게시판' (상위 3개)
  const { data: hotCases, isLoading: isLoadingHot, error: hotError } = useQuery<CaseDocument[], Error>({
    queryKey: caseKeys.list('HOT'),
    queryFn: () => getHotCases(3),
    enabled: selectedTab === 'HOT 게시판',
    staleTime: 1000 * 10,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  // Query for '이전 재판' (CLOSED + voteEndAt desc)
  const { data: recentClosedCases, isLoading: isLoadingRecentClosed, error: recentClosedError } = useQuery<{ cases: CaseDocument[] }, Error>({
    queryKey: [...caseKeys.list('CLOSED'), 'RECENT_DASHBOARD'],
    queryFn: () => getCasesPaginated({ status: 'CLOSED', limitCount: 10, orderByField: 'voteEndAt', orderDirection: 'desc' }) as any,
    enabled: selectedTab === '재판 완료',
    staleTime: 1000 * 10,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: any) => {
    if (isLoadingOpenCases || isFetchingNextOpenCases) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreOpenCases) fetchNextOpenCases();
    });
    if (node) observer.current.observe(node);
  }, [isLoadingOpenCases, isFetchingNextOpenCases, hasMoreOpenCases, fetchNextOpenCases]);

  useEffect(() => {
    const keys = ['caseDetailFromTab', 'completedListFromTab', 'pointMissionFromTab', 'createPostFromTab'];
    keys.forEach(k => sessionStorage.removeItem(k));
    window.history.replaceState({}, document.title);
  }, []);

  // location이 변경될 때 sessionStorage에서 탭 정보 확인 (뒤로가기 대응)
  useEffect(() => {
    const myPostsFromTab = sessionStorage.getItem('myPostsFromTab');
    if (myPostsFromTab) {
      const stateTab = (location.state as any)?.selectedTab;
      if (!stateTab || stateTab !== myPostsFromTab) {
        setSelectedTab(myPostsFromTab);
        // 사용 후 삭제
        sessionStorage.removeItem('myPostsFromTab');
      }
    }
  }, [location]);

  useEffect(() => {
    if (navigationType !== 'POP') window.scrollTo(0, 0);
  }, [selectedTab, navigationType]);

  const isLoading = isLoadingOpenCases || isLoadingHot || isLoadingRecentClosed;
  const error = openCasesError || hotError || recentClosedError;

  return (
    <>
      <div style={{ backgroundColor: 'white', minHeight: '100vh', width: '100%', boxSizing: 'border-box', paddingBottom: '80px' }}>
        <Banner userData={userData} navigate={navigate} selectedTab={selectedTab} />

        <div style={{ padding: '0 20px', backgroundColor: 'white', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #e5e5e5', justifyContent: 'space-between' }}>
            {['재판 중', 'HOT 게시판', '재판 완료'].map(tab => (
              <TabButton key={tab} label={tab} isSelected={selectedTab === tab} onClick={() => {
                setSelectedTab(tab);
                // 탭 변경 시 localStorage에 저장 (새로고침 대응)
                localStorage.setItem('lastSelectedTab', tab);
              }} />
            ))}
          </div>
        </div>

        {selectedTab === '재판 중' && <TabHeader title="재판 중인 글" subtitle="재판에 참여해보세요!" color="#0D47A1" iconSrc="https://static.toss.im/2d-emojis/png/4x/u2696.png" />}
        {selectedTab === 'HOT 게시판' && <TabHeader title="실시간 HOT한 글" subtitle="재판에 참여해보세요!" color="#B71C1C" iconName="icon-fire-red-fill" />}
        {selectedTab === '재판 완료' && <TabHeader title="재판 완료된 글" subtitle="어떤 경우가 합리적이었을까요?" color="#5e403b" isGavel />}

        <div style={{ backgroundColor: 'white' }}>
          {error ? (
            <div style={{ padding: '40px', textAlign: 'center' }}><Text color="#D32F2F">게시물을 불러오는 중 오류가 발생했습니다. (인덱스 생성 중일 수 있습니다)</Text></div>
          ) : selectedTab === '재판 완료' ? (
            <CompletedPostListMain recentPosts={recentClosedCases?.cases || []} navigate={navigate} />
          ) : (
            <div>
              {isLoading && <div style={{ padding: '40px', textAlign: 'center', minHeight: '80vh' }}><Text color="#6B7684">로딩 중...</Text></div>}
              {selectedTab === '재판 중' && (openCasesData?.pages as any[])?.flatMap(p => p.cases).map((post, idx, arr) => (
                <div key={post.id} ref={idx === arr.length - 1 ? lastElementRef : null}>
                  <CaseItem post={post} selectedTab={selectedTab} navigate={navigate} />
                </div>
              ))}
              {selectedTab === 'HOT 게시판' && hotCases?.map((post, idx) => (
                <HotCardItem key={post.id} post={post} index={idx} navigate={navigate} />
              ))}
              {isFetchingNextOpenCases && <div style={{ padding: '20px', textAlign: 'center' }}><Text color="#6B7684">더 불러오는 중...</Text></div>}
            </div>
          )}
        </div>

        <Spacing size={24} />
        <style>{` @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.8); } to { opacity: 1; transform: translateY(0) scale(1); } } `}</style>
      </div>
      <BottomTabBar />
    </>
  );
}

const TabButton = ({ label, isSelected, onClick }: any) => (
  <button
    onClick={onClick}
    style={{
      background: 'none',
      border: 'none',
      padding: '12px 0',
      cursor: 'pointer',
      position: 'relative',
      fontWeight: isSelected ? '600' : '400',
      color: isSelected ? '#191F28' : adaptive.grey600,
      fontSize: '15px',
      flex: 1,
      textAlign: 'center',
    }}
  >
    {label}
    {isSelected && <div style={{ position: 'absolute', bottom: '-1px', left: 0, right: 0, height: '2px', backgroundColor: '#191F28' }} />}
  </button>
);

const Banner = ({ userData, navigate, selectedTab }: any) => {
  const currentPoints = userData?.totalExchangedPoints || 0;
  const currentGavel = userData?.points || 0;

  return (
    <div style={{ backgroundColor: 'white', padding: '16px 20px 24px 20px', width: '100%', boxSizing: 'border-box', borderBottom: '1px solid #F0F0F0' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <Asset.Icon
          frameShape={{ width: 18, height: 18 }}
          backgroundColor="transparent"
          name="icon-point-yellow-full"
          aria-hidden={true}
        />
        <Text color={adaptive.grey600} typography="t6" fontWeight="medium" style={{ fontSize: '15px' }}>
          나의 포인트
        </Text>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
          <Text display="block" color={adaptive.grey800} typography="t1" fontWeight="bold" style={{ fontSize: '38px', lineHeight: '1' }}>
            {currentPoints}
          </Text>
          <Text display="block" color={adaptive.grey800} typography="t5" fontWeight="bold" style={{ fontSize: '22px' }}>
            원
          </Text>
        </div>

        <div
          onClick={() => { sessionStorage.setItem('pointMissionFromTab', selectedTab); navigate('/point-mission', { state: { fromTab: selectedTab } }); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 12px 4px 8px', borderRadius: '30px',
            border: '1px solid #E5E8EB',
            cursor: 'pointer'
          }}
        >
          <Asset.Icon
            frameShape={Asset.frameShape.CircleXSmall}
            backgroundColor={adaptive.greyOpacity100}
            name="icon-gavel"
            scale={0.66}
            aria-hidden={true}
          />
          <Text color={adaptive.grey800} typography="t4" fontWeight="medium" style={{ fontSize: '16px' }}>
            {currentGavel}
          </Text>
        </div>
      </div>

      <div
        style={{
          width: 'calc(100% - 16px)', padding: '10px 0', margin: '0 8px',
          background: 'linear-gradient(90deg, #F9F0E6 0%, #FFFFFF 50%, #F9F0E6 100%)', borderRadius: '8px',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
        }}
      >
        <Text color="#666666" typography="t7" fontWeight="medium" style={{ fontSize: '13px' }}>
          판사봉 50개당 5원으로 전환 가능
        </Text>
      </div>
    </div>
  );
};

const TabHeader = ({ title, subtitle, color, icon, iconName, iconSrc, isGavel }: any) => (
  <div style={{ padding: '0 20px', background: 'linear-gradient(180deg, #FAF0E6 0%, #ffffff 100%)', paddingTop: '16px' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
      <div style={{ flex: 1, paddingTop: '13px' }}>
        <Text display="block" color={color} typography="t3" fontWeight="bold" style={{ fontSize: '22px' }}>{title}</Text>
        <Text display="block" color="#191F28" typography="t7" fontWeight="regular">{subtitle}</Text>
      </div>
      <div style={{ marginLeft: '16px' }}>
        {isGavel ? <Asset.Icon frameShape={Asset.frameShape.CleanW60} name="icon-gavel" style={{ width: '80px', height: '80px' }} /> : iconSrc ? <Asset.Image frameShape={Asset.frameShape.CleanW60} src={iconSrc} style={{ width: '80px', height: '80px' }} /> : iconName ? <Asset.Icon frameShape={Asset.frameShape.CleanW60} name={iconName} style={{ width: '80px', height: '80px' }} /> : icon ? <img src={icon} alt={title} style={{ width: '80px', height: '80px', objectFit: 'contain' }} /> : null}
      </div>
    </div>
    <div style={{ height: '1px', borderTop: '1px solid #F0F0F0', marginLeft: '-20px', marginRight: '-20px', width: 'calc(100% + 40px)' }} />
  </div>
);



function CompletedPostListMain({ recentPosts, navigate }: any) {
  const processPost = (p: any) => {
    const vc = (p.guiltyCount || 0) + (p.innocentCount || 0);
    return { ...p, verdict: vc > 0 ? (p.innocentCount > p.guiltyCount ? '무죄' : p.guiltyCount > p.innocentCount ? '유죄' : '보류') : '보류' };
  };

  const prev = recentPosts.map(processPost).slice(0, 5);

  const renderCard = (p: any) => (
    <div key={p.id} onClick={() => navigate(`/case/${p.id}`, { state: { fromTab: '재판 완료' } })} style={{ backgroundColor: '#F7F3EE', borderRadius: '10px', padding: '16px', minWidth: '172px', width: '172px', height: '211px', marginRight: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box', position: 'relative' }}>
      <div style={{ padding: '6px 12px', backgroundColor: p.verdict === '무죄' ? '#3182F628' : p.verdict === '유죄' ? '#F0445228' : '#4E596828', color: p.verdict === '무죄' ? '#1976D2' : p.verdict === '유죄' ? '#D32F2F' : '#6B7684', fontSize: '14px', fontWeight: '600', borderRadius: '5px', width: 'fit-content' }}>{p.verdict}</div>
      <div style={{ position: 'absolute', top: '22px', right: '16px' }}><Asset.Icon frameShape={Asset.frameShape.CleanW24} name="icon-system-arrow-right-outlined" color="rgba(0, 19, 43, 0.38)" /></div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text display="block" color="#191F28" typography="t4" fontWeight="bold" style={{ textAlign: 'center', WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4', fontSize: '18px' }}>{p.title}</Text>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', backgroundColor: 'white', paddingBottom: '24px', paddingTop: '16px' }}>
      <CompletedSection title="이전 재판 기록" iconName="icon-document-folder-yellow" posts={prev} onMore={() => navigate('/completed-previous')} renderCard={renderCard} />
      <style>{` div::-webkit-scrollbar { display: none; } `}</style>
    </div>
  );
}

const CompletedSection = ({ title, iconSrc, iconName, posts, onMore, renderCard }: any) => {
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const infoPopupRef = useRef<HTMLDivElement>(null);
  const isTrending = title === '화제의 재판 기록';

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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', marginBottom: '16px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {iconSrc ? <Asset.Image frameShape={Asset.frameShape.CleanW24} src={iconSrc} style={{ aspectRatio: '1/1' }} /> : <Asset.Icon frameShape={Asset.frameShape.CleanW24} name={iconName} ratio="1/1" />}
          <Text display="block" color={adaptive.grey900} typography="t3" fontWeight="bold" style={{ fontSize: '22px' }}>{title}</Text>
          {isTrending && (
            <div ref={infoPopupRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginLeft: '4px' }}>
              <div
                onClick={() => setShowInfoPopup(!showInfoPopup)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Asset.Icon
                  frameShape={Asset.frameShape.CleanW16}
                  backgroundColor="transparent"
                  name="icon-info-circle-mono"
                  color="#9E9E9E"
                  aria-hidden={true}
                  ratio="1/1"
                />
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
                  zIndex: 1002,
                  whiteSpace: 'nowrap',
                  fontSize: '13px',
                  color: '#191F28',
                  display: 'inline-block',
                  lineHeight: '1.4'
                }}>
                  <Text color="#191F28" typography="t7" fontWeight="medium" style={{ fontSize: '13px', whiteSpace: 'nowrap', display: 'inline' }}>
                    특히 많은 관심을 받았던 사건들이에요
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
          )}
        </div>
        <button onClick={onMore} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
          <Asset.Icon frameShape={Asset.frameShape.CleanW24} name="icon-arrow-left-big-mono" color="#9E9E9E" />
        </button>
      </div>
      {posts.length > 0 ? (
        <div style={{ overflowX: 'auto', padding: '0 20px', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', flexDirection: 'row', gap: '0', paddingRight: '20px' }}>{posts.map(renderCard)}</div>
        </div>
      ) : <div style={{ padding: '20px', textAlign: 'center' }}><Text color="#6B7684">{title}이 없습니다.</Text></div>}
    </div>
  );
};

export default HomePage;