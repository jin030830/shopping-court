import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Asset, Text, Spacing } from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { useState, useEffect } from 'react';
import { getAllCases, type CaseDocument } from '../api/cases';

function HomePage() {
  const { user, userData, isLoading: isAuthLoading, logout } = useAuth();
  const [selectedTab, setSelectedTab] = useState('재판 중');
  const [allPosts, setAllPosts] = useState<CaseDocument[]>([]);
  const [isPostsLoading, setIsPostsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

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
      {/* Header */}
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
          {user && (
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

      {/* Tabs */}
      <div style={{ padding: '0 20px', backgroundColor: 'white', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid #e5e5e5' }}>
          {/* Tabs remain the same */}
        </div>
      </div>

      <Spacing size={16} />

      {/* Posts Section */}
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
        
        {isPostsLoading ? (
          <p>게시물을 불러오는 중...</p>
        ) : error ? (
          <p style={{ color: 'red' }}>{error}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {allPosts.map((post) => (
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
                    {post.authorNickname}
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
                  {post.content}
                </Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Text color={adaptive.grey600} typography="t8" fontWeight="regular">
                    {(post.guiltyCount + post.innocentCount).toLocaleString()}명 투표 중
                  </Text>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Spacing size={24} />

      {/* Floating Action Button */}
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
