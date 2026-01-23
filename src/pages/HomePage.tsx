import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Asset, Text, Spacing } from '@toss/tds-mobile';
import { useState, useEffect } from 'react';
import { getAllCases, getCommentCount, type CaseDocument } from '../api/cases';
import { Timestamp } from 'firebase/firestore';
import scaleIcon from '../assets/저울모양.png';
import gavelIcon from '../assets/판사봉.png';
import hotFlameIcon from '../assets/핫게시판불모양.png';

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
  const { user, userData, logout } = useAuth();
  const location = useLocation();
  const [selectedTab, setSelectedTab] = useState((location.state as any)?.selectedTab || '재판 중');
  const [allPosts, setAllPosts] = useState<CaseDocument[]>([]);
  const [isPostsLoading, setIsPostsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedFilter, setCompletedFilter] = useState<'전체' | '무죄' | '유죄'>('전체');
  const navigate = useNavigate();

  // location.state에서 탭 정보를 받아오면 탭 변경
  useEffect(() => {
    if ((location.state as any)?.selectedTab) {
      setSelectedTab((location.state as any).selectedTab);
      // state를 초기화하여 다시 뒤로가기 해도 계속 같은 탭이 선택되지 않도록
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        setIsPostsLoading(true);
        const cases = await getAllCases();
        setAllPosts(cases);
      } catch (err) {
        setError('게시물을 불러오는 중 오류가 발생했습니다.');
        console.error(err);
      } finally {
        setIsPostsLoading(false);
      }
    };

    fetchCases();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      alert('로그아웃되었습니다.');
    } catch (error) {
      console.error('로그아웃 오류:', error);
      alert('로그아웃에 실패했습니다.');
    }
  };

  return (
    <div style={{ 
      backgroundColor: '#F8F9FA', 
      minHeight: '100vh',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <Spacing size={14} />
      
      {/* 헤더 */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '0 20px',
        backgroundColor: 'white',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Asset.Image
            frameShape={Asset.frameShape.CleanW16}
            src="https://static.toss.im/appsintoss/15155/4dfa3fe7-556e-424d-820a-61a865a49168.png"
            aria-hidden={true}
          />
          <Text color="#191F28ff" typography="t6" fontWeight="semibold">
            소비 재판소
          </Text>
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: '8px',
          backgroundColor: 'rgba(0, 23, 51, 0.02)',
          borderRadius: '99px',
          padding: '0 4px'
        }}>
          {user && userData && (
            <button 
              onClick={handleLogout}
              style={{ 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer',
                padding: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              aria-label="더보기"
            >
              <Asset.Icon
                frameShape={Asset.frameShape.CleanW20}
                name="icon-dots-mono"
                color="rgba(0, 19, 43, 0.58)"
                aria-hidden={true}
              />
            </button>
          )}
          <div style={{
            width: '1px',
            height: '16px',
            backgroundColor: 'rgba(0, 27, 55, 0.1)'
          }} />
          <button 
            onClick={() => window.close()}
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer',
              padding: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label="닫기"
          >
            <Asset.Icon
              frameShape={Asset.frameShape.CleanW20}
              name="icon-x-mono"
              color="rgba(0, 19, 43, 0.58)"
              aria-hidden={true}
            />
          </button>
        </div>
      </div>

      <Spacing size={12} />

      {/* 탭 */}
      <div style={{ padding: '0 20px', backgroundColor: 'white', paddingBottom: '12px' }}>
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

      <Spacing size={16} />

      {/* 재판 중 탭일 때만 표시되는 섹션 */}
      {selectedTab === '재판 중' && (
        <div style={{ padding: '0 20px', marginBottom: '20px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <div style={{ flex: 1 }}>
              <Text 
                display="block" 
                color="#191F28ff" 
                typography="t3" 
                fontWeight="bold"
                style={{ marginBottom: '8px' }}
              >
                재판 중인 글
              </Text>
              <Text 
                display="block" 
                color="#191F28" 
                typography="t7" 
                fontWeight="regular"
                style={{ marginBottom: '12px' }}
              >
                재판에 참여해보세요!
              </Text>
              <button
                onClick={() => navigate('/create-post')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#E3F2FD',
                  color: '#1976D2',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                글쓰기
              </button>
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
        </div>
      )}

      {/* HOT 게시판 탭일 때만 표시되는 섹션 */}
      {selectedTab === 'HOT 게시판' && (
        <div style={{ padding: '0 20px', marginBottom: '20px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <div style={{ flex: 1 }}>
              <Text 
                display="block" 
                color="#191F28ff" 
                typography="t3" 
                fontWeight="bold"
                style={{ marginBottom: '8px' }}
              >
                실시간 HOT한 글
              </Text>
              <Text 
                display="block" 
                color="#191F28" 
                typography="t7" 
                fontWeight="regular"
                style={{ marginBottom: '12px' }}
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
        </div>
      )}

      {/* 재판 완료 탭일 때만 표시되는 섹션 */}
      {selectedTab === '재판 완료' && (
        <div style={{ padding: '0 20px', marginBottom: '20px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <div style={{ flex: 1 }}>
              <Text 
                display="block" 
                color="#191F28ff" 
                typography="t3" 
                fontWeight="bold"
                style={{ marginBottom: '8px' }}
              >
                재판 완료된 글
              </Text>
              <Text 
                display="block" 
                color="#191F28" 
                typography="t7" 
                fontWeight="regular"
                style={{ marginBottom: '12px' }}
              >
                어떤 경우가 합리적이었을까요?
              </Text>
            </div>
            <div style={{ marginLeft: '16px' }}>
              <img 
                src={gavelIcon} 
                alt="판사봉" 
                style={{ 
                  width: '80px', 
                  height: '80px',
                  objectFit: 'contain'
                }} 
              />
            </div>
          </div>
          
          {/* 필터 버튼 */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginBottom: '16px'
          }}>
            {(['전체', '무죄', '유죄'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setCompletedFilter(filter)}
                style={{
                  padding: '6px 16px',
                  backgroundColor: completedFilter === filter ? '#191F28' : 'transparent',
                  color: completedFilter === filter ? 'white' : '#666',
                  border: 'none',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: completedFilter === filter ? '600' : '400',
                  cursor: 'pointer'
                }}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 게시글 목록 */}
      {selectedTab === '재판 완료' ? (
        <div style={{ padding: '0' }}>
          {isPostsLoading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <Text color="#6B7684">게시물을 불러오는 중...</Text>
            </div>
          ) : error ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <Text color="#D32F2F">{error}</Text>
            </div>
          ) : (
            <CompletedPostList 
              posts={allPosts} 
              navigate={navigate}
              getCommentCount={getCommentCount}
              filter={completedFilter}
            />
          )}
        </div>
      ) : (
        <div style={{ padding: '0 20px' }}>
          {isPostsLoading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
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
              getCommentCount={getCommentCount}
            />
          )}
        </div>
      )}

      <Spacing size={24} />
    </div>
  );
}

// PostList 컴포넌트를 별도로 분리
interface PostListProps {
  posts: CaseDocument[];
  selectedTab: string;
  navigate: (path: string, state?: any) => void;
  getCommentCount: (caseId: string) => Promise<number>;
}

function PostList({ posts, selectedTab, navigate, getCommentCount }: PostListProps) {
  const [postsWithDetails, setPostsWithDetails] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPostDetails = async () => {
      setIsLoading(true);
      try {
        const postsWithData = await Promise.all(
          posts.map(async (post) => {
            // 댓글 개수는 화면 표시에 필요하므로 유지합니다.
            let commentCount = 0;
            try {
              commentCount = await getCommentCount(post.id);
            } catch (error) {
              console.error(`댓글 개수 조회 실패 (${post.id}):`, error);
            }

            // voteCount는 화면 표시에 필요하므로 유지합니다.
            const voteCount = post.guiltyCount + post.innocentCount;
            
            // HOT 점수 계산: 투표수 + 2*댓글수
            const hotScore = voteCount + (2 * commentCount);
            
            // 재판 결과 결정 (innocent가 많으면 무죄, guilty가 많으면 유죄)
            const verdict = voteCount > 0 
              ? (post.innocentCount >= post.guiltyCount ? '무죄' : '유죄')
              : null;

            return {
              ...post, // DB에 저장된 status가 여기에 포함됩니다.
              voteCount,
              commentCount,
              hotScore, // 실시간으로 계산된 HOT 점수
              verdict
            };
          })
        );

        setPostsWithDetails(postsWithData);
      } catch (error) {
        console.error('게시물 상세 정보 처리 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPostDetails();
  }, [posts, getCommentCount]);

  if (isLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Text color="#6B7684">게시물 정보를 불러오는 중...</Text>
      </div>
    );
  }

  // 탭별 게시물 필터링 및 정렬
  let displayPosts = postsWithDetails;
  
  if (selectedTab === 'HOT 게시판') {
    // 재판 중인 게시물만 필터링하고 HOT 점수로 정렬, 상위 5개만 표시
    // HOT 점수가 0보다 큰 게시물만 표시 (투표나 댓글이 있는 게시물만)
    displayPosts = postsWithDetails
      .filter(post => post.status === 'OPEN' && post.hotScore > 0)
      .sort((a, b) => b.hotScore - a.hotScore)
      .slice(0, 5);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
              {/* 왼쪽: 무죄/유죄 배지 */}
              <div style={{
                padding: '8px 16px',
                backgroundColor: post.verdict === '무죄' ? '#E3F2FD' : '#FFEBEE',
                color: post.verdict === '무죄' ? '#1976D2' : '#D32F2F',
                fontSize: '14px',
                fontWeight: '600',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
                minWidth: 'fit-content'
              }}>
                {post.verdict || '미결정'}
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
                  fontSize: '15px', 
                  color: '#191F28',
                  fontWeight: '500',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
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
              padding: '16px', 
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <Text color="#191F28" typography="t7" fontWeight="regular">
                {post.authorNickname}
              </Text>
              {post.createdAt && (
                <Text color="#9E9E9E" typography="t7" fontWeight="regular">
                  {formatDate(post.createdAt)}
                </Text>
              )}
            </div>
            <Text 
              display="block" 
              color="#191F28ff" 
              typography="t2" 
              fontWeight="semibold"
              style={{ marginBottom: '4px' }}
            >
              {post.title}
            </Text>
            <Text 
              display="block" 
              color="#191F28ff" 
              typography="t7" 
              fontWeight="regular"
              style={{ 
                marginBottom: '8px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}
            >
              {post.content}
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Text color="#6B7684" typography="t7" fontWeight="regular">
                {post.voteCount.toLocaleString()}명 투표 중
              </Text>
              {post.commentCount > 0 && (
                <>
                  <span style={{ color: '#C4C4C4' }}>•</span>
                  <Text color="#6B7684" typography="t7" fontWeight="regular">
                    댓글 {post.commentCount}
                  </Text>
                </>
              )}
              {selectedTab === 'HOT 게시판' && (
                <>
                  <span style={{ color: '#C4C4C4' }}>•</span>
                  <Text color="#FF6B6B" typography="t7" fontWeight="semibold">
                    🔥 TOP {index + 1}
                  </Text>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 재판 완료 전용 컴포넌트
interface CompletedPostListProps {
  posts: CaseDocument[];
  navigate: (path: string, state?: any) => void;
  getCommentCount: (caseId: string) => Promise<number>;
  filter: '전체' | '무죄' | '유죄';
}

function CompletedPostList({ posts, navigate, getCommentCount, filter }: CompletedPostListProps) {
  const [postsWithDetails, setPostsWithDetails] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPostDetails = async () => {
      setIsLoading(true);
      try {
        const postsWithData = await Promise.all(
          posts.map(async (post) => {
            let commentCount = 0;
            try {
              commentCount = await getCommentCount(post.id);
            } catch (error) {
              console.error(`댓글 개수 조회 실패 (${post.id}):`, error);
            }

            const voteCount = post.guiltyCount + post.innocentCount;
            const hotScore = voteCount + (2 * commentCount);
            const verdict = voteCount > 0 
              ? (post.innocentCount >= post.guiltyCount ? '무죄' : '유죄')
              : null;

            return {
              ...post,
              voteCount,
              commentCount,
              hotScore,
              verdict
            };
          })
        );

        setPostsWithDetails(postsWithData);
      } catch (error) {
        console.error('게시물 상세 정보 로드 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPostDetails();
  }, [posts, getCommentCount]);

  if (isLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Text color="#6B7684">게시물 정보를 불러오는 중...</Text>
      </div>
    );
  }

  const formatDate = (timestamp: Timestamp | undefined) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 재판 완료된 전체 게시물 (필터 적용)
  const allCompletedPosts = postsWithDetails
    .filter(post => post.status === 'CLOSED')
    .filter(post => {
      if (filter === '전체') return true;
      if (filter === '무죄') return post.verdict === '무죄';
      if (filter === '유죄') return post.verdict === '유죄';
      return true;
    })
    .sort((a, b) => {
      const dateA = a.voteEndAt?.toMillis() || 0;
      const dateB = b.voteEndAt?.toMillis() || 0;
      return dateB - dateA;
    });

  // HOT 게시판에 있던 상태로 재판이 완료된 글들 (HOT 점수 기준)
  const hotCompletedPosts = postsWithDetails
    .filter(post => post.status === 'CLOSED' && post.hotScore > 0)
    .sort((a, b) => b.hotScore - a.hotScore);

  const renderPostCard = (post: any) => (
    <div
      key={post.id}
      onClick={() => navigate(`/case/${post.id}`, { state: { fromTab: '재판 완료' } })}
      style={{
        backgroundColor: '#f2f4f6',
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
        boxSizing: 'border-box'
      }}
    >
      {/* 배지 */}
      <div style={{
        padding: '4px 8px',
        backgroundColor: post.verdict === '무죄' ? '#3182F628' : '#F0445228',
        color: post.verdict === '무죄' ? '#1976D2' : '#D32F2F',
        fontSize: '12px',
        fontWeight: '600',
        borderRadius: '4px',
        width: 'fit-content'
      }}>
        {post.verdict || '미결정'}
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
          typography="t3"
          fontWeight="bold"
          style={{
            textAlign: 'center',
            wordBreak: 'break-word',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            lineHeight: '1.4'
          }}
        >
          {post.title}
        </Text>
      </div>

      {/* 날짜 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 'auto'
      }}>
        <Text
          display="block"
          color="#6B7684"
          typography="t7"
          fontWeight="regular"
        >
          {formatDate(post.voteEndAt)}
        </Text>
        <Asset.Icon
          frameShape={Asset.frameShape.CleanW24}
          backgroundColor="transparent"
          name="icon-system-arrow-right-outlined"
          color="rgba(0, 19, 43, 0.38)"
          aria-hidden={true}
        />
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 위쪽: 재판 완료된 전체 게시물 */}
      <div>
        <div style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: '0 20px',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          cursor: 'grab'
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
            {allCompletedPosts.map(renderPostCard)}
          </div>
        </div>
        <style>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </div>

      {/* 아래쪽: 화제의 재판 기록 */}
      {hotCompletedPosts.length > 0 && (
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0 20px',
            marginBottom: '16px'
          }}>
            <img
              src={hotFlameIcon}
              alt="화제"
              style={{
                width: '24px',
                height: '24px',
                objectFit: 'contain'
              }}
            />
            <Text
              display="block"
              color="#191F28"
              typography="t4"
              fontWeight="bold"
            >
              화제의 재판 기록
            </Text>
          </div>
          <div style={{
            overflowX: 'auto',
            overflowY: 'hidden',
            padding: '0 20px',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            cursor: 'grab'
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
        </div>
      )}
    </div>
  );
}

export default HomePage;
