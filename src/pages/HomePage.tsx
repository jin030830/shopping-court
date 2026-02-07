import { useNavigate, useLocation, useNavigationType } from 'react-router-dom';
import { Asset, Text, Spacing } from '@toss/tds-mobile';
import { useState, useEffect } from 'react';
import { getAllCases, type CaseDocument } from '../api/cases';
import { Timestamp } from 'firebase/firestore';
import { adaptive } from '@toss/tds-colors';
import scaleIcon from '../assets/scale.svg';
import hotFlameIcon from '../assets/fire.png';
import pointMissionImage from '../assets/missionbanner.jpeg';

// 단순 메모리 캐시 (전역 변수)
let postsCache: CaseDocument[] | null = null;

// 날짜 포맷팅 함수 (M/d HH:mm 형식)
const formatDate = (timestamp: Timestamp): string => {
  const date = timestamp.toDate();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return `${month}/${day} ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  
  // 푸시 알림에서 온 경우 URL parameter 확인하고 리다이렉트
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const caseId = searchParams.get('caseId');
    
    if (caseId) {
      console.log('[Shopping Court] 푸시 알림에서 이동:', caseId);
      // URL parameter 제거하고 게시글로 이동
      navigate(`/case/${caseId}`, { replace: true });
    }
  }, [location.search, navigate]);

  // 초기값: location.state 또는 sessionStorage에서 즉시 복원
  const [selectedTab, setSelectedTab] = useState(() => {
    // 1. location.state 확인
    const stateTab = (location.state as any)?.selectedTab;
    if (stateTab) return stateTab;

    // 2. sessionStorage 확인 (상세 페이지나 다른 페이지에서 돌아온 경우)
    const detailTab = sessionStorage.getItem('caseDetailFromTab');
    if (detailTab) return detailTab;

    const completedTab = sessionStorage.getItem('completedListFromTab');
    if (completedTab) return completedTab;

    const missionTab = sessionStorage.getItem('pointMissionFromTab');
    if (missionTab) return missionTab;

    const createTab = sessionStorage.getItem('createPostFromTab');
    if (createTab) return createTab;

    return 'HOT 게시판';
  });

  const [allPosts, setAllPosts] = useState<CaseDocument[]>(postsCache || []);
  const [isPostsLoading, setIsPostsLoading] = useState(!postsCache);
  const [isFabExpanded, setIsFabExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 뒤로가기 시 사용한 세션 데이터 정리 (한 번 사용 후 삭제)
  useEffect(() => {
    const keys = ['caseDetailFromTab', 'completedListFromTab', 'pointMissionFromTab', 'createPostFromTab'];
    keys.forEach(key => {
      if (sessionStorage.getItem(key)) {
        sessionStorage.removeItem(key);
      }
    });
    
    // state를 초기화하여 다시 뒤로가기 해도 계속 같은 탭이 선택되지 않도록
    window.history.replaceState({}, document.title);
  }, []);

  // 탭이 변경될 때마다 상단으로 스크롤
  useEffect(() => {
    // POP(뒤로가기 등)인 경우에는 스크롤 복원을 위해 상단 이동을 건너뜀
    if (navigationType === 'POP') return;

    // 탭 변경 시 상단으로 즉시 스크롤
    window.scrollTo(0, 0);
  }, [selectedTab, navigationType]);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        // 캐시가 없을 때만 명시적 로딩 표시
        if (!postsCache) setIsPostsLoading(true);
        const cases = await getAllCases();
        setAllPosts(cases);
        postsCache = cases; // 전역 캐시 업데이트
      } catch (err) {
        setError('게시물을 불러오는 중 오류가 발생했습니다.');
        console.error(err);
      } finally {
        setIsPostsLoading(false);
      }
    };

    fetchCases();
  }, []);

  return (
    <div style={{ 
        backgroundColor: 'white', 
        minHeight: '100vh',
        width: '100%',
        boxSizing: 'border-box'
      }}>
      {/* 포인트 미션 배너 */}
      <div style={{
        backgroundColor: 'white',
        padding: '0px',
        width: '100%',
        boxSizing: 'border-box',
        marginTop: '0px'
      }}>
        <div style={{
          margin: '0px',
          width: '100%',
          height: '147px',
          backgroundColor: '#FAF0E6',
          borderRadius: '0px',
          padding: '16px 20px',
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0px 4px 3px 0px rgba(0, 0, 0, 0.25)'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            position: 'relative',
            zIndex: 1,
            height: '100%',
            width: '100%'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ flex: 1, paddingLeft: '8px', paddingTop: '4px' }}>
                <Text
                  display="block"
                  color="#191F28"
                  typography="t2"
                  fontWeight="bold"
                  style={{ lineHeight: '1.4', fontSize: '20px' }}
                >
                  재판에 참여하고{'\n'}포인트를 모아보세요
                </Text>
              </div>
            </div>
            
            <div style={{ 
              position: 'absolute',
              bottom: '4px',
              left: '8px',
              cursor: 'pointer',
              zIndex: 2
            }}
              onClick={() => {
                // 미션 페이지에서 뒤로가기 시 원래 보고 있던 탭으로 복귀
                sessionStorage.setItem('pointMissionFromTab', selectedTab);
                navigate('/point-mission', { state: { fromTab: selectedTab } });
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '8px 16px',
                backgroundColor: '#5E403B',
                borderRadius: '10px',
                boxShadow: '0px 0px 4px 0px rgba(255, 255, 255, 1)',
                width: 'fit-content'
              }}>
                <Text
                  display="block"
                  color="white"
                  typography="t6"
                  fontWeight="bold"
                >
                  미션 확인하기
                </Text>
                <Asset.Icon
                  frameShape={Asset.frameShape.CleanW16}
                  backgroundColor="transparent"
                  name="icon-arrow-right-mono"
                  color="white"
                  aria-hidden={true}
                  ratio="1/1"
                />
              </div>
            </div>
          </div>
          
          {/* 판사봉 이미지 (배경) */}
          <div style={{
            position: 'absolute',
            bottom: '25px',
            right: '25px',
            zIndex: 0,
            width: '150px',
            height: '150px',
            backgroundImage: `url(${pointMissionImage})`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'bottom right',
            filter: 'drop-shadow(2px 4px 6px rgba(0, 0, 0, 0.3))'
          }}>
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ 
        padding: '0 20px', 
        backgroundColor: 'white', 
        paddingBottom: '0px',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e5e5', justifyContent: 'space-between' }}>
          <button
            onClick={() => setSelectedTab('재판 중')}
            style={{
              background: 'none',
              border: 'none',
              padding: '12px 0',
              cursor: 'pointer',
              position: 'relative',
              fontWeight: selectedTab === '재판 중' ? '600' : '400',
              color: selectedTab === '재판 중' ? '#191F28' : '#666',
              fontSize: '15px',
              flex: 1,
              textAlign: 'center'
            }}
          >
            재판 중
            {selectedTab === '재판 중' && (
              <div style={{
                position: 'absolute',
                bottom: '-1px',
                left: 0,
                right: 0,
                height: '2px',
                backgroundColor: '#191F28'
              }} />
            )}
          </button>
          <button
            onClick={() => setSelectedTab('HOT 게시판')}
            style={{
              background: 'none',
              border: 'none',
              padding: '12px 0',
              cursor: 'pointer',
              position: 'relative',
              fontWeight: selectedTab === 'HOT 게시판' ? '600' : '400',
              color: selectedTab === 'HOT 게시판' ? '#191F28' : '#666',
              fontSize: '15px',
              flex: 1,
              textAlign: 'center'
            }}
          >
            HOT 게시판
            {selectedTab === 'HOT 게시판' && (
              <div style={{
                position: 'absolute',
                bottom: '-1px',
                left: 0,
                right: 0,
                height: '2px',
                backgroundColor: '#191F28'
              }} />
            )}
          </button>
          <button
            onClick={() => setSelectedTab('재판 완료')}
            style={{
              background: 'none',
              border: 'none',
              padding: '12px 0',
              cursor: 'pointer',
              position: 'relative',
              fontWeight: selectedTab === '재판 완료' ? '600' : '400',
              color: selectedTab === '재판 완료' ? '#191F28' : '#666',
              fontSize: '15px',
              flex: 1,
              textAlign: 'center'
            }}
          >
            재판 완료
            {selectedTab === '재판 완료' && (
              <div style={{
                position: 'absolute',
                bottom: '-1px',
                left: 0,
                right: 0,
                height: '2px',
                backgroundColor: '#191F28'
              }} />
            )}
          </button>
        </div>
      </div>

      {/* 재판 중 탭일 때만 표시되는 섹션 */}
      {selectedTab === '재판 중' && (
        <div style={{ 
          padding: '0 20px', 
          marginBottom: '0px',
          background: 'linear-gradient(180deg, #FAF0E6 0%, #ffffff 100%)',
          paddingTop: '16px',
          paddingBottom: '0px',
          marginTop: '0px'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            justifyContent: 'space-between',
            marginBottom: '12px'
          }}>
            <div style={{ flex: 1, paddingTop: '6px' }}>
              <Text 
                display="block" 
                color="#0D47A1" 
                typography="t3" 
                fontWeight="bold"
                style={{ marginBottom: '8px', fontSize: '22px' }}
              >
                재판 중인 글
              </Text>
              <Text 
                display="block" 
                color="#191F28" 
                typography="t7" 
                fontWeight="regular"
                style={{ marginBottom: '0px' }}
              >
                재판에 참여해보세요!
              </Text>
            </div>
            <div style={{ marginLeft: '16px' }}>
              <img 
                src={scaleIcon} 
                alt="저울" 
                style={{ 
                  width: '80px', 
                  height: '80px',
                  objectFit: 'contain'
                }} 
              />
            </div>
          </div>
          <div style={{ 
            height: '1px', 
            borderTop: '1px solid #F0F0F0',
            marginTop: '0px',
            marginBottom: '0px',
            marginLeft: '-20px',
            marginRight: '-20px',
            width: 'calc(100% + 40px)'
          }} />
        </div>
      )}

      {/* HOT 게시판 탭일 때만 표시되는 섹션 */}
      {selectedTab === 'HOT 게시판' && (
        <div style={{ 
          padding: '0 20px', 
          marginBottom: '0px',
          background: 'linear-gradient(180deg, #FAF0E6 0%, #ffffff 100%)',
          paddingTop: '16px',
          paddingBottom: '0px',
          marginTop: '0px'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            justifyContent: 'space-between',
            marginBottom: '12px'
          }}>
            <div style={{ flex: 1, paddingTop: '6px' }}>
              <Text 
                display="block" 
                color="#B71C1C" 
                typography="t3" 
                fontWeight="bold"
                style={{ marginBottom: '8px', fontSize: '22px' }}
              >
                실시간 HOT한 글
              </Text>
              <Text 
                display="block" 
                color="#191F28" 
                typography="t7" 
                fontWeight="regular"
                style={{ marginBottom: '0px' }}
              >
                재판에 참여해보세요!
              </Text>
            </div>
            <div style={{ marginLeft: '16px' }}>
              <img 
                src={hotFlameIcon} 
                alt="핫게시판" 
                style={{ 
                  width: '80px', 
                  height: '80px',
                  objectFit: 'contain'
                }} 
              />
            </div>
          </div>
          <div style={{ 
            height: '1px', 
            borderTop: '1px solid #F0F0F0',
            marginTop: '0px',
            marginBottom: '0px',
            marginLeft: '-20px',
            marginRight: '-20px',
            width: 'calc(100% + 40px)'
          }} />
        </div>
      )}

      {/* 재판 완료 탭일 때만 표시되는 섹션 */}
      {selectedTab === '재판 완료' && (
        <div style={{ 
          padding: '0 20px', 
          marginBottom: '0px',
          background: 'linear-gradient(180deg, #FAF0E6 0%, #ffffff 100%)',
          paddingTop: '16px',
          paddingBottom: '0px',
          marginTop: '0px'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            justifyContent: 'space-between',
            marginBottom: '18px'
          }}>
            <div style={{ flex: 1, paddingTop: '6px' }}>
              <Text 
                display="block" 
                color="#5e403b" 
                typography="t3" 
                fontWeight="bold"
                style={{ marginBottom: '8px', fontSize: '22px' }}
              >
                재판 완료된 글
              </Text>
              <Text 
                display="block" 
                color="#191F28" 
                typography="t7" 
                fontWeight="regular"
                style={{ marginBottom: '0px' }}
              >
                어떤 경우가 합리적이었을까요?
              </Text>
            </div>
            <div style={{ marginLeft: '16px' }}>
              <Asset.Icon
                frameShape={Asset.frameShape.CleanW60}
                name="icon-gavel"
                aria-hidden={true}
                style={{ width: '80px', height: '80px' }}
              />
            </div>
          </div>
          <div style={{ 
            height: '1px', 
            borderTop: '1px solid #F0F0F0',
            marginTop: '0px',
            marginBottom: '0px',
            marginLeft: '-20px',
            marginRight: '-20px',
            width: 'calc(100% + 40px)'
          }} />
        </div>
      )}

      {/* 게시글 목록 */}
      {selectedTab === '재판 완료' ? (
        <CompletedPostListMain 
          posts={allPosts} 
          navigate={navigate}
          isLoading={isPostsLoading}
          error={error}
        />
      ) : (
        <div style={{ backgroundColor: 'white' }}>
          {isPostsLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', minHeight: '80vh' }}>
              <Text color="#6B7684">게시물을 불러오는 중...</Text>
            </div>
          ) : error ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <Text color="#D32F2F">{error}</Text>
            </div>
          ) : (
            <PostList 
              posts={allPosts} 
              selectedTab={selectedTab} 
              navigate={navigate}
            />
          )}
        </div>
      )}

      {/* 확장형 플로팅 버튼 */}
      {selectedTab !== '재판 완료' && (
      <div style={{
        position: 'fixed',
        bottom: '36px',
        right: '32px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px'
      }}>
        {/* 사용자 아이콘 (위) */}
        {isFabExpanded && (
          <button
            onClick={() => {
              navigate('/my-posts');
              setIsFabExpanded(false);
            }}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              animation: 'slideUp 0.3s ease-out 0.1s both',
              transformOrigin: 'bottom'
            }}
          >
            <Asset.Icon
              frameShape={Asset.frameShape.CircleXLarge}
              backgroundColor="#fef6f0"
              name="icon-user-mono"
              color="#5e403b"
              scale={0.66}
              aria-hidden={true}
            />
          </button>
        )}
        
        {/* 연필 아이콘 (아래) */}
        {isFabExpanded && (
          <button
            onClick={() => {
              setIsFabExpanded(false);
              // 글작성 후 원래 보던 탭으로 복귀
              sessionStorage.setItem('createPostFromTab', selectedTab);
              navigate('/create-post', { state: { fromTab: selectedTab } });
            }}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              animation: 'slideUp 0.3s ease-out',
              transformOrigin: 'bottom'
            }}
          >
            <Asset.Icon
              frameShape={Asset.frameShape.CircleXLarge}
              backgroundColor="#fdf6f0"
              name="icon-pencil-line-mono"
              color="#5e403b"
              scale={0.66}
              aria-hidden={true}
            />
          </button>
        )}
        
        {/* 메인 버튼 (+ 또는 X) */}
        <button
          onClick={() => setIsFabExpanded(!isFabExpanded)}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            transition: 'transform 0.3s ease-out'
          }}
        >
          {isFabExpanded ? (
            <Asset.Icon
              frameShape={Asset.frameShape.CircleXLarge}
              backgroundColor="#5e403b"
              name="icon-x-mono"
              color="#fef6f1"
              scale={0.66}
              aria-hidden={true}
            />
          ) : (
            <Asset.Icon
              frameShape={Asset.frameShape.CircleXLarge}
              backgroundColor="#5e403b"
              name="icon-plus-thin-mono"
              color="#fef6f1"
              scale={0.66}
              aria-hidden={true}
            />
          )}
        </button>
      </div>
      )}
      
      {/* 애니메이션 스타일 */}
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.8);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>

      <Spacing size={24} />
    </div>
  );
}

// PostList 컴포넌트를 별도로 분리
interface PostListProps {
  posts: CaseDocument[];
  selectedTab: string;
  navigate: (path: string, state?: any) => void;
}

function PostList({ posts, selectedTab, navigate }: PostListProps) {
  // 초기 데이터 가공 (마운트 시 즉시 실행하여 로딩 지연 제거)
  const processPosts = (rawPosts: CaseDocument[]) => {
    return rawPosts.map((post) => {
      const actualCommentCount = post.commentCount || 0;
      const voteCount = (post.guiltyCount || 0) + (post.innocentCount || 0);
      const hotScore = voteCount + (2 * actualCommentCount);
      
      let verdict: '무죄' | '유죄' | '보류' = '보류';
      if (voteCount > 0) {
        if (post.innocentCount > post.guiltyCount) {
          verdict = '무죄';
        } else if (post.guiltyCount > post.innocentCount) {
          verdict = '유죄';
        } else {
          verdict = '보류';
        }
      }
      return { ...post, commentCount: actualCommentCount, voteCount, hotScore, verdict };
    });
  };

  const [postsWithDetails, setPostsWithDetails] = useState<any[]>(() => processPosts(posts));
  const [isLoading, setIsLoading] = useState(posts.length === 0);

  useEffect(() => {
    if (posts.length > 0) {
      setPostsWithDetails(processPosts(posts));
      setIsLoading(false);
    }
  }, [posts]);

  if (isLoading && postsWithDetails.length === 0) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        backgroundColor: 'white',
        minHeight: '80vh'
      }}>
        <Text color="#6B7684">게시물 정보를 불러오는 중...</Text>
      </div>
    );
  }

  // 탭별 게시물 필터링 및 정렬
  let displayPosts = postsWithDetails;
  
  if (selectedTab === 'HOT 게시판') {
    // 재판 중인 게시물만 필터링하고 HOT 점수로 정렬, 상위 3개만 표시
    // HOT 점수가 0보다 큰 게시물만 표시 (투표나 댓글이 있는 게시물만)
    displayPosts = postsWithDetails
      .filter(post => post.status === 'OPEN' && post.hotScore > 0)
      .sort((a, b) => {
        // HOT 점수 내림차순
        if (b.hotScore !== a.hotScore) {
          return b.hotScore - a.hotScore;
        }
        // 동률일 때는 작성일 오름차순 (먼저 쓴 사람 우선)
        const dateA = a.createdAt?.toMillis() || 0;
        const dateB = b.createdAt?.toMillis() || 0;
        return dateA - dateB;
      })
      .slice(0, 3);
  } else if (selectedTab === '재판 완료') {
    // status가 'CLOSED'인 게시물만 필터링하고 완료일 최신순으로 정렬
    displayPosts = postsWithDetails
      .filter(post => post.status === 'CLOSED')
      .sort((a, b) => {
        const dateA = a.voteEndAt?.toMillis() || 0;
        const dateB = b.voteEndAt?.toMillis() || 0;
        return dateB - dateA;
      });
  } else {
    // 재판 중: status가 'OPEN'인 게시물만 표시
    displayPosts = postsWithDetails.filter(post => post.status === 'OPEN');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
      {displayPosts.map((post, index) => {
        // 재판 완료 탭일 경우 다른 레이아웃
        if (selectedTab === '재판 완료') {
          const formatDate = (timestamp: Timestamp | undefined) => {
            if (!timestamp) return '';
            const date = timestamp.toDate();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}.${month}.${day}`;
          };

          return (
            <div 
              key={post.id}
              onClick={() => navigate(`/case/${post.id}`, { state: { fromTab: selectedTab } })}
              style={{ 
                backgroundColor: 'white', 
                padding: '16px', 
                borderRadius: '8px',
                border: '1px solid #e5e5e5',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              {/* 왼쪽: 무죄/유죄/보류 배지 */}
              <div style={{
                padding: '8px 16px',
                backgroundColor: (post.verdict || '보류') === '무죄' ? '#E3F2FD' : (post.verdict || '보류') === '유죄' ? '#FFEBEE' : '#F2F4F6',
                color: (post.verdict || '보류') === '무죄' ? '#1976D2' : (post.verdict || '보류') === '유죄' ? '#D32F2F' : '#6B7684',
                fontSize: '14px',
                fontWeight: '600',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
                minWidth: 'fit-content'
              }}>
                {post.verdict || '보류'}
              </div>

              {/* 가운데: 날짜와 제목 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* 판결 완료 날짜 */}
                <div style={{ 
                  fontSize: '12px', 
                  color: '#6B7684',
                  marginBottom: '4px'
                }}>
                  {formatDate(post.voteEndAt)}
                </div>
                {/* 제목 */}
                <div style={{ 
                  fontSize: '18px',
                  lineHeight: '1.4', 
                  color: '#191F28',
                  fontWeight: '500',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  textAlign: 'center'
                }}>
                  {post.title}
                </div>
              </div>

              {/* 오른쪽: 화살표 아이콘 */}
              <Asset.Icon
                frameShape={Asset.frameShape.CleanW20}
                name="icon-arrow-right-mono"
                color="rgba(0, 19, 43, 0.38)"
                aria-label="자세히 보기"
              />
            </div>
          );
        }

        // 재판 중 / HOT 게시판 레이아웃
        return (
          <div 
            key={post.id}
            onClick={() => navigate(`/case/${post.id}`, { state: { fromTab: selectedTab } })}
            style={{ 
              backgroundColor: 'white', 
              padding: '16px 20px', 
              borderTop: 'none',
              borderBottom: '1px solid #F0F0F0',
              cursor: 'pointer',
              marginTop: index === 0 ? '0px' : '0px'
            }}
          >
            {selectedTab === 'HOT 게시판' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                <Asset.Icon
                  frameShape={Asset.frameShape.CleanW20}
                  backgroundColor="transparent"
                  name="icon-emoji-fire"
                  aria-hidden={true}
                  ratio="1/1"
                />
                <Text
                  display="block"
                  color="#FF6B6B"
                  typography="t6"
                  fontWeight="bold"
                >
                  TOP {index + 1}
                </Text>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
              <Text 
                display="block" 
                color="#191F28" 
                typography="t4" 
                fontWeight="bold"
                style={{ 
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  fontSize: '18px',
                  lineHeight: '1.4',
                  textAlign: 'center'
                }}
              >
                {post.title}
              </Text>
              {post.createdAt && (
                <Text color="#9E9E9E" typography="st13" fontWeight="regular" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {formatDate(post.createdAt)}
                </Text>
              )}
            </div>
            <div
              style={{ 
                marginBottom: '8px',
                lineHeight: '1.5',
                color: '#191F28ff',
                fontSize: '14px',
                wordBreak: 'break-word',
                textAlign: 'left'
              }}
            >
              {post.content && post.content.length > 50 ? `${post.content.substring(0, 50)}...` : post.content}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Asset.Icon
                  frameShape={{ width: 13, height: 13 }}
                  backgroundColor="transparent"
                  name="icon-user-two-mono"
                  color="#5e403b"
                  aria-hidden={true}
                  ratio="1/1"
                />
                <Text color="#5e403b" typography="st13" fontWeight="medium">
                  {(post.guiltyCount || 0) + (post.innocentCount || 0)}
                </Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Asset.Icon
                  frameShape={{ width: 13, height: 13 }}
                  backgroundColor="transparent"
                  name="icon-chat-bubble-mono"
                  color="#5E403Bff"
                  aria-hidden={true}
                  ratio="1/1"
                />
                <Text color="#5e403b" typography="st13" fontWeight="medium">
                  {post.commentCount ?? 0}
                </Text>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 재판 완료 메인 컴포넌트 (첫 번째 화면)
interface CompletedPostListMainProps {
  posts: CaseDocument[];
  navigate: (path: string, state?: any) => void;
  isLoading: boolean;
  error: string | null;
}

function CompletedPostListMain({ posts, navigate, isLoading, error }: CompletedPostListMainProps) {
  // 초기 데이터 가공 (마운트 시 즉시 실행하여 로딩 지연 제거)
  const processPosts = (rawPosts: CaseDocument[]) => {
    return rawPosts.map((post) => {
      const voteCount = post.guiltyCount + post.innocentCount;
      const hotScore = voteCount + (2 * (post.commentCount || 0));
      let verdict: '무죄' | '유죄' | '보류' = '보류';
      if (voteCount > 0) {
        if (post.innocentCount > post.guiltyCount) {
          verdict = '무죄';
        } else if (post.guiltyCount > post.innocentCount) {
          verdict = '유죄';
        } else {
          verdict = '보류';
        }
      }
      return { ...post, voteCount, hotScore, verdict };
    });
  };

  const [postsWithDetails, setPostsWithDetails] = useState<any[]>(() => processPosts(posts));
  const [isLoadingDetails, setIsLoadingDetails] = useState(posts.length === 0);

  useEffect(() => {
    if (posts.length > 0) {
      setPostsWithDetails(processPosts(posts));
      setIsLoadingDetails(false);
    }
  }, [posts]);

  if ((isLoading || isLoadingDetails) && postsWithDetails.length === 0) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        backgroundColor: 'white',
        minHeight: '80vh'
      }}>
        <Text color="#6B7684">게시물 정보를 불러오는 중...</Text>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Text color="#D32F2F">{error}</Text>
      </div>
    );
  }

  // 화제의 재판 기록 (hotScore > 0)
  const hotCompletedPosts = postsWithDetails
    .filter(post => post.status === 'CLOSED' && post.hotScore > 0)
    .sort((a, b) => {
      // HOT 점수 내림차순
      if (b.hotScore !== a.hotScore) {
        return b.hotScore - a.hotScore;
      }
      // 동률일 때는 작성일 오름차순 (먼저 쓴 사람 우선)
      const dateA = a.createdAt?.toMillis() || 0;
      const dateB = b.createdAt?.toMillis() || 0;
      return dateA - dateB;
    })
    .slice(0, 5); // 최대 5개만 표시

  // 이전 재판 기록 (모든 CLOSED 상태의 글 포함)
  const previousCompletedPosts = postsWithDetails
    .filter(post => post.status === 'CLOSED')
    .sort((a, b) => {
      const dateA = a.voteEndAt?.toMillis() || 0;
      const dateB = b.voteEndAt?.toMillis() || 0;
      return dateB - dateA;
    })
    .slice(0, 5); // 최대 5개만 표시

  const renderPostCard = (post: any) => (
    <div
      key={post.id}
      onClick={() => navigate(`/case/${post.id}`, { state: { fromTab: '재판 완료' } })}
      style={{
        backgroundColor: '#F7F3EE',
        borderRadius: '10px',
        padding: '16px',
        minWidth: '172px',
        width: '172px',
        height: '211px',
        marginRight: '12px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxSizing: 'border-box',
        position: 'relative'
      }}
    >
      {/* 배지 */}
      <div style={{
        padding: '6px 12px',
        backgroundColor: (post.verdict || '보류') === '무죄' ? '#3182F628' : (post.verdict || '보류') === '유죄' ? '#F0445228' : '#4E596828',
        color: (post.verdict || '보류') === '무죄' ? '#1976D2' : (post.verdict || '보류') === '유죄' ? '#D32F2F' : '#6B7684',
        fontSize: '14px',
        fontWeight: '600',
        borderRadius: '5px',
        width: 'fit-content'
      }}>
        {post.verdict || '보류'}
      </div>

      {/* 화살표 아이콘 - 우측 위 (배지와 같은 선상) */}
      <div style={{
        position: 'absolute',
        top: '22px',
        right: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Asset.Icon
          frameShape={Asset.frameShape.CleanW24}
          backgroundColor="transparent"
          name="icon-system-arrow-right-outlined"
          color="rgba(0, 19, 43, 0.38)"
          aria-hidden={true}
        />
      </div>

      {/* 제목 */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 0
      }}>
        <Text
          display="block"
          color="#191F28"
          typography="t4"
          fontWeight="bold"
          style={{
            textAlign: 'center',
            wordBreak: 'break-word',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: '1.4',
            fontSize: '18px'
          }}
        >
          {post.title}
        </Text>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '61px', backgroundColor: 'white', paddingBottom: '24px', paddingTop: '16px' }}>
      {/* 화제의 재판 기록 */}
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Asset.Image
              frameShape={Asset.frameShape.CleanW24}
              backgroundColor="transparent"
              src="https://static.toss.im/2d-emojis/png/4x/u1F525.png"
              aria-hidden={true}
              style={{ aspectRatio: '1/1' }}
            />
            <Text
              display="block"
              color={adaptive.grey900}
              typography="t4"
              fontWeight="bold"
              style={{ fontSize: '18px' }}
            >
              화제의 재판 기록
            </Text>
          </div>
          <button
            onClick={() => navigate('/completed-trending')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Asset.Icon
              frameShape={Asset.frameShape.CleanW24}
              backgroundColor="transparent"
              name="icon-arrow-left-big-mono"
              color="#9E9E9E"
              aria-hidden={true}
              ratio="1/1"
            />
          </button>
        </div>
        {hotCompletedPosts.length > 0 ? (
          <div style={{
            overflowX: 'auto',
            overflowY: 'hidden',
            padding: '0 20px',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
          onWheel={(e) => {
            const container = e.currentTarget;
            container.scrollLeft += e.deltaY;
            e.preventDefault();
          }}
          >
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              gap: '0',
              paddingRight: '20px'
            }}>
              {hotCompletedPosts.map(renderPostCard)}
            </div>
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <Text color="#6B7684">화제의 재판 기록이 없습니다.</Text>
          </div>
        )}
      </div>

      {/* 이전 재판 기록 */}
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Asset.Icon
              frameShape={Asset.frameShape.CleanW24}
              backgroundColor="transparent"
              name="icon-document-folder-yellow"
              aria-hidden={true}
              ratio="1/1"
            />
            <Text
              display="block"
              color={adaptive.grey900}
              typography="t4"
              fontWeight="bold"
              style={{ fontSize: '18px' }}
            >
              이전 재판 기록
            </Text>
          </div>
          <button
            onClick={() => navigate('/completed-previous')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Asset.Icon
              frameShape={Asset.frameShape.CleanW24}
              backgroundColor="transparent"
              name="icon-arrow-left-big-mono"
              color="#9E9E9E"
              aria-hidden={true}
              ratio="1/1"
            />
          </button>
        </div>
        {previousCompletedPosts.length > 0 ? (
          <div style={{
            overflowX: 'auto',
            overflowY: 'hidden',
            padding: '0 20px',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
          onWheel={(e) => {
            const container = e.currentTarget;
            container.scrollLeft += e.deltaY;
            e.preventDefault();
          }}
          >
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              gap: '0',
              paddingRight: '20px'
            }}>
              {previousCompletedPosts.map(renderPostCard)}
            </div>
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <Text color="#6B7684">이전 재판 기록이 없습니다.</Text>
          </div>
        )}
      </div>
      
      <style>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}


export default HomePage;