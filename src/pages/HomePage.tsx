import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Asset, Text, Spacing } from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { useState, useEffect } from 'react';
import { getAllCases, getCommentCount, type CaseDocument } from '../api/cases';
import scaleIcon from '../assets/저울모양.png';
import gavelIcon from '../assets/판사봉.png';
import hotFlameIcon from '../assets/핫게시판불모양.png';

function HomePage() {
  const { user, userData, isLoading, logout } = useAuth();
  const location = useLocation();
  const [selectedTab, setSelectedTab] = useState((location.state as any)?.selectedTab || '재판 중');
  const [allPosts, setAllPosts] = useState<CaseDocument[]>([]);
  const [isPostsLoading, setIsPostsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      backgroundColor: adaptive.background, 
      minHeight: '100vh',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* 헤더 */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '14px 20px',
        backgroundColor: 'white',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Asset.Image
            frameShape={Asset.frameShape.CleanW16}
            src="https://static.toss.im/appsintoss/15155/4dfa3fe7-556e-424d-820a-61a865a49168.png"
            aria-hidden={true}
            style={{ width: '32px', height: '32px' }}
          />
          <Text color="#191F28ff" typography="t6" fontWeight="semibold">
            소비 재판소
          </Text>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {user && userData && (
            <button 
              onClick={handleLogout}
              style={{ 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <Asset.Icon
                frameShape={Asset.frameShape.CleanW20}
                name="icon-dots-mono"
                color="rgba(0, 19, 43, 0.58)"
                aria-label="로그아웃"
              />
            </button>
          )}
        </div>
      </div>

      <Spacing size={12} />

      {/* 탭 - 삼등분 */}
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
                color={adaptive.grey700} 
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
                color={adaptive.grey700} 
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
                color={adaptive.grey700} 
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
        </div>
      )}

      {/* 게시글 목록 */}
      <div style={{ padding: '0 20px' }}>
        {isPostsLoading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <Text color={adaptive.grey600}>게시물을 불러오는 중...</Text>
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
        const now = Date.now();
        
        const postsWithData = await Promise.all(
          posts.map(async (post) => {
            // 투표 시간 만료 여부 계산 (48시간)
            const createdAt = post.createdAt?.toMillis() || now;
            const voteEndAt = post.voteEndAt?.toMillis() || createdAt + 48 * 60 * 60 * 1000;
            const isVotingExpired = now > voteEndAt;
            const completedDate = isVotingExpired ? new Date(voteEndAt) : null;

            // 댓글 개수 가져오기
            let commentCount = 0;
            try {
              commentCount = await getCommentCount(post.id);
            } catch (error) {
              console.error(`댓글 개수 조회 실패 (${post.id}):`, error);
            }

            // HOT 점수 계산: 투표수 + 2*댓글수
            const voteCount = post.guiltyCount + post.innocentCount;
            const hotScore = voteCount + (2 * commentCount);

            // 재판 결과 결정 (innocent가 많으면 무죄, guilty가 많으면 유죄)
            const verdict = voteCount > 0 
              ? (post.innocentCount >= post.guiltyCount ? '무죄' : '유죄')
              : null;

            return {
              ...post,
              voteCount,
              commentCount,
              hotScore,
              isVotingExpired,
              completedDate,
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
        <Text color={adaptive.grey600}>게시물 정보를 불러오는 중...</Text>
      </div>
    );
  }

  // 탭별 게시물 필터링 및 정렬
  let displayPosts = postsWithDetails;
  
  if (selectedTab === 'HOT 게시판') {
    // 재판 중인 게시물만 필터링하고 HOT 점수로 정렬, 상위 5개만 표시
    displayPosts = postsWithDetails
      .filter(post => !post.isVotingExpired)
      .sort((a, b) => b.hotScore - a.hotScore)
      .slice(0, 5);
  } else if (selectedTab === '재판 완료') {
    // 투표 시간이 만료된 게시물만 필터링하고 완료일 최신순으로 정렬
    displayPosts = postsWithDetails
      .filter(post => post.isVotingExpired)
      .sort((a, b) => {
        const dateA = a.completedDate?.getTime() || 0;
        const dateB = b.completedDate?.getTime() || 0;
        return dateB - dateA;
      });
  } else {
    // 재판 중: 투표 시간이 아직 남은 게시물만 표시
    displayPosts = postsWithDetails.filter(post => !post.isVotingExpired);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {displayPosts.map((post, index) => {
        // 재판 완료 탭일 경우 다른 레이아웃
        if (selectedTab === '재판 완료') {
          const formatDate = (date: Date | null) => {
            if (!date) return '';
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
                  color: adaptive.grey600,
                  marginBottom: '4px'
                }}>
                  {formatDate(post.completedDate)}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Text color={adaptive.grey700} typography="t8" fontWeight="regular">
                {post.authorNickname}
              </Text>
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
              <Text color={adaptive.grey600} typography="t8" fontWeight="regular">
                {post.voteCount.toLocaleString()}명 투표 중
              </Text>
              {post.commentCount > 0 && (
                <>
                  <span style={{ color: adaptive.grey400 }}>•</span>
                  <Text color={adaptive.grey600} typography="t8" fontWeight="regular">
                    댓글 {post.commentCount}
                  </Text>
                </>
              )}
              {selectedTab === 'HOT 게시판' && (
                <>
                  <span style={{ color: adaptive.grey400 }}>•</span>
                  <Text color="#FF6B6B" typography="t8" fontWeight="semibold">
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

export default HomePage;
