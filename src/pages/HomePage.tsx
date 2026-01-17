import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Asset, Text, Spacing } from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { useState, useEffect } from 'react';

// Mock 데이터 (기본 게시물)
const mockPosts = [
  {
    id: '1',
    title: '37만원 헤드셋 살까 말까?',
    author: 'alstjs',
    content: '24살 대학생입니다. 현재 알바로 월에 50만원 정도 벌고 있는데, 몇 달 전부터 헤드셋이 계속 갖고 싶더라구요.. 운동하거나 공부할 때 ~~~',
    description: '24살 대학생입니다. 현재 알바로 월에 50만원 정도 벌고 있는데, 몇 달 전부터 헤드셋이 계속 갖고 싶더라구요.. 운동하거나 공부할 때 ~~~',
    voteCount: 1138,
  },
  {
    id: '2',
    title: '배달비 5000원, 적당한가요?',
    author: 'toss_user',
    content: '배달비 인상에 대한 여러분의 의견을 들려주세요. 소비자와 자영업자 모두 상생할 방법은 없을까요?',
    description: '배달비 인상에 대한 여러분의 의견을 들려주세요. 소비자와 자영업자 모두 상생할 방법은 없을까요?',
    voteCount: 2048,
  },
];

function HomePage() {
  const { user, userData, isLoading, logout } = useAuth();
  const [selectedTab, setSelectedTab] = useState('재판 중');
  const [allPosts, setAllPosts] = useState(mockPosts);
  const navigate = useNavigate();

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

      {/* 재판 중인 글 */}
      <div style={{ padding: '0 20px' }}>
        <Text 
          display="block" 
          color="#191F28ff" 
          typography="t5" 
          fontWeight="bold"
          style={{ marginBottom: '16px' }}
        >
          재판 중인 글
        </Text>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {allPosts.map((post) => {
            // 각 게시물의 투표 통계 가져오기
            let voteCount = post.voteCount || 0;
            let commentCount = 0;
            
            try {
              const statsKey = `vote_stats_${post.id}`;
              const savedStats = localStorage.getItem(statsKey);
              if (savedStats) {
                const stats = JSON.parse(savedStats);
                voteCount = (stats.agree || 0) + (stats.disagree || 0);
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

            return (
              <div 
                key={post.id}
                onClick={() => navigate(`/case/${post.id}`)}
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
                    {voteCount.toLocaleString()}명 투표 중
                  </Text>
                  {commentCount > 0 && (
                    <>
                      <span style={{ color: adaptive.grey400 }}>•</span>
                      <Text color={adaptive.grey600} typography="t8" fontWeight="regular">
                        댓글 {commentCount}
                      </Text>
                    </>
                  )}
                </div>
              </div>
            );
          })}
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
