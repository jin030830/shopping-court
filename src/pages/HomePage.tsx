import { useNavigate, useLocation, useNavigationType } from 'react-router-dom';
import { Asset, Text, Spacing } from '@toss/tds-mobile';
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { getCasesPaginated, getHotCases, type CaseDocument } from '../api/cases';
import { Timestamp } from 'firebase/firestore';
import { adaptive } from '@toss/tds-colors';
import pointMissionImage from '../assets/pansascale.png';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { caseKeys } from '../constants/queryKeys';

// 날짜 포맷팅 함수
const formatDate = (timestamp: Timestamp): string => {
  const date = timestamp.toDate();
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

// 게시물 아이템 컴포넌트
const CaseItem = memo(({ post, index, selectedTab, navigate }: any) => (
  <div onClick={() => navigate(`/case/${post.id}`, { state: { fromTab: selectedTab } })}
    style={{ backgroundColor: 'white', padding: '16px 20px', borderBottom: '1px solid #F0F0F0', cursor: 'pointer' }}>
    {selectedTab === 'HOT 게시판' && (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Asset.Icon frameShape={Asset.frameShape.CleanW20} backgroundColor="transparent" name="icon-emoji-fire" aria-hidden={true} ratio="1/1" />
          <Text display="block" color="#FF6B6B" typography="t6" fontWeight="bold">TOP {index + 1}</Text>
        </div>
        {post.createdAt && <Text color="#9E9E9E" typography="st13" fontWeight="regular" style={{ fontSize: '14px' }}>{formatDate(post.createdAt)}</Text>}
      </div>
    )}
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
      <Text display="block" color="#191F28" typography="t4" fontWeight="bold" style={{ flex: 1, textAlign: 'center', WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{post.title}</Text>
      {selectedTab === '재판 중' && post.createdAt && <Text color="#9E9E9E" typography="st13" fontWeight="regular" style={{ fontSize: '14px' }}>{formatDate(post.createdAt)}</Text>}
    </div>
    <div style={{ marginBottom: '8px', lineHeight: '1.5', color: '#191F28', fontSize: '14px', wordBreak: 'break-word' }}>
      {post.content && post.content.length > 50 ? `${post.content.substring(0, 50)}...` : post.content}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <StatItem icon="icon-user-two-mono" count={(post.guiltyCount || 0) + (post.innocentCount || 0)} />
      <StatItem icon="icon-chat-bubble-mono" count={post.commentCount ?? 0} />
    </div>
  </div>
));

const StatItem = ({ icon, count }: any) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
    <Asset.Icon frameShape={{ width: 15, height: 15 }} backgroundColor="transparent" name={icon} color="#5e403b" aria-hidden={true} ratio="1/1" />
    <Text color="#5e403b" typography="st13" fontWeight="medium" style={{ fontSize: '14px' }}>{count}</Text>
  </div>
);

function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const [isFabExpanded, setIsFabExpanded] = useState(false);
  
  const [selectedTab, setSelectedTab] = useState(() => {
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
    staleTime: 1000 * 10, // [Optimization] 10초 동안은 캐시 유지
  });

  // Query for 'HOT 게시판' (상위 3개)
  const { data: hotCases, isLoading: isLoadingHot, error: hotError } = useQuery<CaseDocument[], Error>({
    queryKey: caseKeys.list('HOT'),
    queryFn: () => getHotCases(3),
    enabled: selectedTab === 'HOT 게시판',
    staleTime: 1000 * 10,
  });

  // Query for '재판 완료' 대시보드
  const { data: completedDashboard, isLoading: isLoadingCompleted, error: completedError } = useQuery<{ cases: CaseDocument[] }, Error>({
    queryKey: caseKeys.list('CLOSED_DASHBOARD'),
    queryFn: () => getCasesPaginated({ status: 'CLOSED', limitCount: 10 }) as any,
    enabled: selectedTab === '재판 완료',
    staleTime: 1000 * 10,
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

  const isLoading = isLoadingOpenCases || isLoadingHot || isLoadingCompleted;
  const error = openCasesError || hotError || completedError;

  return (
    <div style={{ backgroundColor: 'white', minHeight: '100vh', width: '100%', boxSizing: 'border-box' }}>
      <Banner navigate={navigate} selectedTab={selectedTab} />
      
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
          <CompletedPostListMain posts={completedDashboard?.cases || []} navigate={navigate} />
        ) : (
          <div>
            {isLoading && <div style={{ padding: '40px', textAlign: 'center', minHeight: '80vh' }}><Text color="#6B7684">로딩 중...</Text></div>}
            {selectedTab === '재판 중' && (openCasesData?.pages as any[])?.flatMap(p => p.cases).map((post, idx, arr) => (
              <div key={post.id} ref={idx === arr.length - 1 ? lastElementRef : null}>
                <CaseItem post={post} selectedTab={selectedTab} navigate={navigate} />
              </div>
            ))}
            {selectedTab === 'HOT 게시판' && hotCases?.map((post, idx) => (
              <CaseItem key={post.id} post={post} index={idx} selectedTab={selectedTab} navigate={navigate} />
            ))}
            {isFetchingNextOpenCases && <div style={{ padding: '20px', textAlign: 'center' }}><Text color="#6B7684">더 불러오는 중...</Text></div>}
          </div>
        )}
      </div>

      {selectedTab !== '재판 완료' && <Fab isExpanded={isFabExpanded} setIsExpanded={setIsFabExpanded} navigate={navigate} selectedTab={selectedTab} />}
      <Spacing size={24} />
      <style>{` @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.8); } to { opacity: 1; transform: translateY(0) scale(1); } } `}</style>
    </div>
  );
}

const TabButton = ({ label, isSelected, onClick }: any) => (
  <button onClick={onClick} style={{ background: 'none', border: 'none', padding: '12px 0', cursor: 'pointer', position: 'relative', fontWeight: isSelected ? '600' : '400', color: isSelected ? '#191F28' : '#666', fontSize: '15px', flex: 1, textAlign: 'center' }}>
    {label}
    {isSelected && <div style={{ position: 'absolute', bottom: '-1px', left: 0, right: 0, height: '2px', backgroundColor: '#191F28' }} />}
  </button>
);

const Banner = ({ navigate, selectedTab }: any) => (
  <div style={{ backgroundColor: 'white', padding: '11px 20px', width: '100%', boxSizing: 'border-box' }}>
    <div style={{ width: '100%', height: '147px', backgroundColor: '#FAF0E6', padding: '12px 12px', boxSizing: 'border-box', position: 'relative', overflow: 'hidden', borderRadius: '10px', boxShadow: '0px 4px 4px 0px rgba(0, 0, 0, 0.25)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative', zIndex: 1, height: '100%' }}>
        <Text display="block" color="#191F28" typography="t2" fontWeight="bold" style={{ lineHeight: '1.4', fontSize: '20px', marginLeft: '14px', marginTop: '8px' }}>재판에 참여하고{"\n"}포인트를 모아보세요</Text>
        <div style={{ position: 'absolute', bottom: '8px', left: '14px', cursor: 'pointer', zIndex: 2 }} onClick={() => { sessionStorage.setItem('pointMissionFromTab', selectedTab); navigate('/point-mission', { state: { fromTab: selectedTab } }); }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px 8px 18px', backgroundColor: '#5E403B', borderRadius: '10px', boxShadow: '0px 0px 4px 0px rgba(255, 255, 255, 1)' }}>
            <Text display="block" color="white" typography="t6" fontWeight="bold">미션 확인하기</Text>
            <Asset.Icon frameShape={Asset.frameShape.CleanW16} name="icon-arrow-right-mono" color="white" ratio="1/1" />
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: '0px', right: '15px', width: '150px', height: '150px', backgroundImage: `url(${pointMissionImage})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'bottom right', filter: 'drop-shadow(2px 4px 6px rgba(0, 0, 0, 0.3))' }} />
    </div>
  </div>
);

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

const Fab = ({ isExpanded, setIsExpanded, navigate, selectedTab }: any) => (
  <div style={{ position: 'fixed', bottom: '36px', right: '32px', zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
    {isExpanded && (
      <>
        <FabItem onClick={() => { sessionStorage.setItem('myPostsFromTab', selectedTab); navigate('/my-posts', { state: { fromTab: selectedTab } }); setIsExpanded(false); }} icon="icon-user-mono" label="내가 쓴 글" delay="0.1s" />
        <FabItem onClick={() => { setIsExpanded(false); sessionStorage.setItem('createPostFromTab', selectedTab); navigate('/create-post', { state: { fromTab: selectedTab } }); }} icon="icon-pencil-line-mono" label="글쓰기" />
      </>
    )}
    <button onClick={() => setIsExpanded(!isExpanded)} style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
      <Asset.Icon frameShape={Asset.frameShape.CircleXLarge} backgroundColor="#5e403b" name={isExpanded ? "icon-x-mono" : "icon-plus-thin-mono"} color="#fef6f1" scale={isExpanded ? 0.5 : 0.66} aria-hidden={true} />
    </button>
  </div>
);

const FabItem = ({ onClick, icon, label, delay }: any) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', animation: `slideUp 0.3s ease-out ${delay || '0s'} both`, transformOrigin: 'bottom' }}>
    <button onClick={onClick} style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
      <Asset.Icon frameShape={Asset.frameShape.CircleXLarge} backgroundColor="#fef6f0" name={icon} color="#5e403b" scale={0.66} aria-hidden={true} />
    </button>
    <Text color="#5e403b" typography="st13" fontWeight="bold" style={{ marginTop: '2px', fontSize: '12px' }}>{label}</Text>
  </div>
);

function CompletedPostListMain({ posts, navigate }: any) {
  const processed = posts.map((p: any) => {
    const vc = (p.guiltyCount || 0) + (p.innocentCount || 0);
    return { ...p, verdict: vc > 0 ? (p.innocentCount > p.guiltyCount ? '무죄' : p.guiltyCount > p.innocentCount ? '유죄' : '보류') : '보류', hotScore: p.hotScore || (vc + (2 * (p.commentCount || 0))) };
  });
  // 대시보드용 정렬 (DB에서 limit 10으로 가져온 데이터 중 상위 5개씩 슬라이스)
  // 화제의 재판 기록: 최신순 정렬 (createdAt 기준)
  const hot = processed.sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)).slice(0, 5);
  const prev = [...processed].sort((a: any, b: any) => (b.voteEndAt?.toMillis() || 0) - (a.voteEndAt?.toMillis() || 0)).slice(0, 5);

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
      <CompletedSection title="화제의 재판 기록" iconSrc="https://static.toss.im/2d-emojis/png/4x/u1F525.png" posts={hot} onMore={() => navigate('/completed-trending')} renderCard={renderCard} />
      <CompletedSection title="이전 재판 기록" iconName="icon-document-folder-yellow" posts={prev} onMore={() => navigate('/completed-previous')} renderCard={renderCard} />
      <style>{` div::-webkit-scrollbar { display: none; } `}</style>
    </div>
  );
}

const CompletedSection = ({ title, iconSrc, iconName, posts, onMore, renderCard }: any) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {iconSrc ? <Asset.Image frameShape={Asset.frameShape.CleanW24} src={iconSrc} style={{ aspectRatio: '1/1' }} /> : <Asset.Icon frameShape={Asset.frameShape.CleanW24} name={iconName} ratio="1/1" />}
        <Text display="block" color={adaptive.grey900} typography="t3" fontWeight="bold" style={{ fontSize: '22px' }}>{title}</Text>
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

export default HomePage;