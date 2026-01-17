import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Asset, Text, Spacing } from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { useState, useEffect } from 'react';

// Mock 데이터 (기본 게시물) - 모두 투표 종료 상태
const mockPosts = [
  {
    id: '1',
    title: '37만원 헤드셋 살까 말까?',
    author: 'alstjs',
    content: '24살 대학생입니다. 현재 알바로 월에 50만원 정도 벌고 있는데, 몇 달 전부터 헤드셋이 계속 갖고 싶더라구요.. 운동하거나 공부할 때 ~~~',
    description: '24살 대학생입니다. 현재 알바로 월에 50만원 정도 벌고 있는데, 몇 달 전부터 헤드셋이 계속 갖고 싶더라구요.. 운동하거나 공부할 때 ~~~',
    voteCount: 1138,
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3일 전 (투표 종료)
  },
  {
    id: '2',
    title: '배달비 5000원, 적당한가요?',
    author: 'toss_user',
    content: '배달비 인상에 대한 여러분의 의견을 들려주세요. 소비자와 자영업자 모두 상생할 방법은 없을까요?',
    description: '배달비 인상에 대한 여러분의 의견을 들려주세요. 소비자와 자영업자 모두 상생할 방법은 없을까요?',
    voteCount: 2048,
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2일 전 (투표 종료)
  },
];

function HomePage() {
  const { user, userData, isLoading, logout } = useAuth();
  const location = useLocation();
  const [selectedTab, setSelectedTab] = useState((location.state as any)?.selectedTab || '재판 중');
  const [allPosts, setAllPosts] = useState(mockPosts);
  const navigate = useNavigate();

  // location.state에서 탭 정보를 받아오면 탭 변경
  useEffect(() => {
    if ((location.state as any)?.selectedTab) {
      setSelectedTab((location.state as any).selectedTab);
      // state를 초기화하여 다시 뒤로가기 해도 계속 같은 탭이 선택되지 않도록
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // localStorage에서 사용자가 작성한 게시물 불러오기
  useEffect(() => {
    try {
      const userPostsStr = localStorage.getItem('user_posts');
      if (userPostsStr) {
        const userPosts = JSON.parse(userPostsStr);
        // 사용자 게시물과 mock 게시물 합치기
        setAllPosts([...userPosts, ...mockPosts]);
      } else {
        setAllPosts(mockPosts);
      }
    } catch (error) {
      console.error('게시물 로드 실패:', error);
      setAllPosts(mockPosts);
    }

    // storage 이벤트 리스너로 실시간 업데이트
    const handleStorageChange = () => {
      try {
        const userPostsStr = localStorage.getItem('user_posts');
        if (userPostsStr) {
          const userPosts = JSON.parse(userPostsStr);
          setAllPosts([...userPosts, ...mockPosts]);
        }
      } catch (error) {
        console.error('게시물 업데이트 실패:', error);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
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

      {/* 탭 */}
      <div style={{ padding: '0 20px', backgroundColor: 'white', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid #e5e5e5' }}>
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
              fontSize: '15px'
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
              fontSize: '15px'
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
              fontSize: '15px'
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

      {/* 게시글 목록 */}
      <div style={{ padding: '0 20px' }}>
        <Text 
          display="block" 
          color="#191F28ff" 
          typography="t5" 
          fontWeight="bold"
          style={{ marginBottom: '16px' }}
        >
          {selectedTab === 'HOT 게시판' ? 'HOT 게시판' : selectedTab === '재판 완료' ? '재판 완료된 글' : '재판 중인 글'}
        </Text>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {(() => {
            // 각 게시물의 HOT 점수 계산 및 재판 완료 여부 확인
            const postsWithScore = allPosts.map((post) => {
              // 게시물 timestamp 가져오기
              let postTimestamp = post.timestamp || new Date().toISOString();
              
              // 투표 시간 만료 여부 계산 (48시간)
              const createdAt = new Date(postTimestamp).getTime();
              const now = Date.now();
              const votingPeriod = 48 * 60 * 60 * 1000; // 48시간
              const endTime = createdAt + votingPeriod;
              const isVotingExpired = now > endTime;
              const completedDate = isVotingExpired ? new Date(endTime) : null;

              // 각 게시물의 투표 통계 가져오기
              let voteCount = post.voteCount || 0;
              let agreeCount = 0;
              let disagreeCount = 0;
              let commentCount = 0;
              
              try {
                const statsKey = `vote_stats_${post.id}`;
                const savedStats = localStorage.getItem(statsKey);
                if (savedStats) {
                  const stats = JSON.parse(savedStats);
                  agreeCount = stats.agree || 0;
                  disagreeCount = stats.disagree || 0;
                  voteCount = agreeCount + disagreeCount;
                }

                // 댓글 수 가져오기
                const commentsKey = `comments_${post.id}`;
                const savedComments = localStorage.getItem(commentsKey);
                if (savedComments) {
                  const comments = JSON.parse(savedComments);
                  if (Array.isArray(comments)) {
                    commentCount = comments.length;
                    // 답글도 카운트
                    comments.forEach(comment => {
                      if (Array.isArray(comment.replies)) {
                        commentCount += comment.replies.length;
                      }
                    });
                  }
                }
              } catch (e) {
                console.error('통계 로드 실패:', e);
              }

              // HOT 점수 계산: 투표수 + 2*댓글수
              const hotScore = voteCount + (2 * commentCount);

              // 재판 결과 결정 (agree가 많으면 무죄, disagree가 많으면 유죄)
              const verdict = voteCount > 0 
                ? (agreeCount >= disagreeCount ? '무죄' : '유죄')
                : null;

              return {
                ...post,
                timestamp: postTimestamp,
                voteCount,
                agreeCount,
                disagreeCount,
                commentCount,
                hotScore,
                isVotingExpired,
                completedDate: completedDate ? new Date(completedDate) : null,
                verdict
              };
            });

            // 탭별 게시물 필터링 및 정렬
            let displayPosts = postsWithScore;
            
            if (selectedTab === 'HOT 게시판') {
              // 재판 중인 게시물만 필터링하고 HOT 점수로 정렬, 상위 5개만 표시
              displayPosts = postsWithScore
                .filter(post => !post.isVotingExpired) // 재판 중인 게시물만
                .sort((a, b) => b.hotScore - a.hotScore)
                .slice(0, 5);
            } else if (selectedTab === '재판 완료') {
              // 투표 시간이 만료된 게시물만 필터링하고 완료일 최신순으로 정렬
              displayPosts = postsWithScore
                .filter(post => post.isVotingExpired)
                .sort((a, b) => {
                  const dateA = a.completedDate?.getTime() || 0;
                  const dateB = b.completedDate?.getTime() || 0;
                  return dateB - dateA; // 최신순
                });
            } else {
              // 재판 중: 투표 시간이 아직 남은 게시물만 표시
              displayPosts = postsWithScore.filter(post => !post.isVotingExpired);
            }

            return displayPosts.map((post, index) => {
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Text color={adaptive.grey700} typography="t8" fontWeight="regular">
                    익명 {post.author}
                  </Text>
                </div>
                <Text 
                  display="block" 
                  color="#191F28ff" 
                  typography="t6" 
                  fontWeight="semibold"
                  style={{ marginBottom: '8px' }}
                >
                  {post.title}
                </Text>
                <Text 
                  display="block" 
                  color="#191F28ff" 
                  typography="t7" 
                  fontWeight="regular"
                  style={{ 
                    marginBottom: '12px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}
                >
                  {post.description || post.content}
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
            });
          })()}
        </div>
      </div>

      <Spacing size={24} />

      {/* 글쓰기 플로팅 버튼 */}
      <button
        onClick={() => navigate('/create-post')}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#3182F6',
          border: 'none',
          boxShadow: '0 4px 12px rgba(49, 130, 246, 0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}
        aria-label="글쓰기"
      >
        <span style={{ 
          fontSize: '28px', 
          color: 'white',
          lineHeight: '1',
          marginBottom: '2px'
        }}>
          ✏️
        </span>
      </button>
    </div>
  );
}

export default HomePage;
