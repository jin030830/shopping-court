import { useNavigate } from 'react-router-dom';
import { Asset, Text, Spacing } from '@toss/tds-mobile';
import { useState, useEffect } from 'react';
import { getAllCases, getComments, getReplies, type CaseDocument } from '../api/cases';
import { Timestamp } from 'firebase/firestore';
import { adaptive } from '@toss/tds-colors';

function CompletedTrendingPage() {
  const navigate = useNavigate();
  
  // 페이지 진입 시 sessionStorage에 '재판 완료' 저장 (토스 앱의 뒤로가기 버튼 대응)
  useEffect(() => {
    sessionStorage.setItem('completedListFromTab', '재판 완료');
  }, []);

  // 브라우저/토스 앱의 뒤로가기 버튼 처리
  useEffect(() => {
    const handlePopState = () => {
      const savedFromTab = sessionStorage.getItem('completedListFromTab') || '재판 완료';
      navigate('/', { state: { selectedTab: savedFromTab }, replace: true });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigate]);
  const [allPosts, setAllPosts] = useState<CaseDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'전체' | '무죄' | '유죄' | '보류'>('전체');
  const [searchKeyword, setSearchKeyword] = useState('');

  useEffect(() => {
    const fetchCases = async () => {
      try {
        setIsLoading(true);
        const cases = await getAllCases();
        setAllPosts(cases);
      } catch (err) {
        console.error('게시물 로드 실패:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCases();
  }, []);

  // 게시물 상세 정보 계산
  const [postsWithDetails, setPostsWithDetails] = useState<any[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);

  useEffect(() => {
    const loadPostDetails = async () => {
      setIsLoadingDetails(true);
      try {
        const postsWithData = await Promise.all(
          allPosts
            .filter(post => post.status === 'CLOSED')
            .map(async (post) => {
              const voteCount = post.guiltyCount + post.innocentCount;
              
              // 실제 댓글 수 조회
              let actualCommentCount = 0;
              try {
                const comments = await getComments(post.id);
                const repliesPromises = comments.map(comment => getReplies(post.id, comment.id));
                const repliesArrays = await Promise.all(repliesPromises);
                actualCommentCount = comments.length + repliesArrays.reduce((sum, replies) => sum + replies.length, 0);
              } catch (error) {
                console.error(`게시글 ${post.id}의 댓글 수 조회 실패:`, error);
              }
              
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
              return {
                ...post,
                commentCount: actualCommentCount,
                voteCount,
                hotScore,
                verdict
              };
            })
        );
        
        const sortedPosts = postsWithData
          .filter(post => post.hotScore > 0)
          .sort((a, b) => b.hotScore - a.hotScore);
        
        setPostsWithDetails(sortedPosts);
      } catch (error) {
        console.error('게시물 상세 정보 처리 실패:', error);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    if (allPosts.length > 0) {
      loadPostDetails();
    }
  }, [allPosts]);

  // 필터 및 검색 적용
  const filteredPosts = postsWithDetails.filter(post => {
    // 검색어 필터
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.trim().toLowerCase();
      const titleMatch = post.title.toLowerCase().includes(keyword);
      const contentMatch = post.content.toLowerCase().includes(keyword);
      if (!titleMatch && !contentMatch) {
        return false;
      }
    }
    
    // verdict 필터
    if (filter === '전체') return true;
    if (filter === '무죄') return post.verdict === '무죄';
    if (filter === '유죄') return post.verdict === '유죄';
    if (filter === '보류') return post.verdict === '보류' || !post.verdict;
    return true;
  });

  const formatDate = (timestamp: Timestamp | undefined) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `${month}/${day} ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ 
      backgroundColor: 'white', 
      minHeight: '100vh',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* Title */}
      <div style={{ padding: '0 20px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
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
        >
          화제의 재판 기록
        </Text>
      </div>

      {/* Search Bar */}
      <div style={{ padding: '0 20px', marginBottom: '16px', position: 'relative' }}>
        <div style={{
          position: 'absolute',
          left: '36px',
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          zIndex: 1
        }}>
          <Asset.Icon
            frameShape={{ width: 20, height: 20 }}
            backgroundColor="transparent"
            name="icon-search-mono"
            color="#9E9E9E"
            aria-hidden={true}
          />
        </div>
        <input
          type="text"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          placeholder="관심 키워드 검색"
          style={{
            width: '100%',
            padding: '12px 16px 12px 44px',
            border: '1px solid #E5E5E5',
            borderRadius: '8px',
            fontSize: '15px',
            backgroundColor: 'white',
            color: '#191F28',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Filter Buttons */}
      <div style={{ padding: '0 20px', marginBottom: '17px', display: 'flex', gap: '8px' }}>
        {(['전체', '무죄', '유죄', '보류'] as const).map((filterOption) => (
          <button
            key={filterOption}
            onClick={() => setFilter(filterOption)}
            style={{
              padding: '6px 16px',
              backgroundColor: filter === filterOption ? '#191F28' : 'transparent',
              color: filter === filterOption ? 'white' : '#666',
              border: 'none',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: filter === filterOption ? '600' : '400',
              cursor: 'pointer'
            }}
          >
            {filterOption}
          </button>
        ))}
      </div>

      <Spacing size={17} />

      {/* Post List */}
      <div style={{ padding: '0 20px', backgroundColor: 'white' }}>
        {isLoading || isLoadingDetails ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <Text color="#6B7684">게시물을 불러오는 중...</Text>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <Text color="#6B7684">표시할 게시물이 없습니다.</Text>
          </div>
        ) : (
          filteredPosts.map((post, index) => {
            const verdict = post.verdict || '보류';
            const badgeBgColor = verdict === '무죄' ? '#E3F2FD' : verdict === '유죄' ? '#FFEBEE' : '#F2F4F6';
            const badgeTextColor = verdict === '무죄' ? '#1976D2' : verdict === '유죄' ? '#D32F2F' : '#6B7684';
            
            return (
              <div key={post.id}>
                <div
                  onClick={() => navigate(`/case/${post.id}`, { state: { fromTab: '재판 완료' } })}
                  style={{
                    backgroundColor: 'white',
                    padding: '16px',
                    borderTop: index === 0 ? '1px solid #F0F0F0' : 'none',
                    borderBottom: '1px solid #F0F0F0',
                    cursor: 'pointer'
                  }}
                >
                  {/* Verdict Badge */}
                  <div style={{
                    padding: '4px 10px',
                    backgroundColor: badgeBgColor,
                    color: badgeTextColor,
                    fontSize: '12px',
                    fontWeight: '600',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    minWidth: 'fit-content',
                    display: 'inline-block',
                    marginBottom: '8px'
                  }}>
                    {verdict}
                  </div>

                  {/* Title and Date */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <Text 
                      display="block" 
                      color="#191F28" 
                      typography="t5" 
                      fontWeight="bold"
                      style={{ flex: 1, marginRight: '12px' }}
                    >
                      {post.title}
                    </Text>
                    {post.createdAt && (
                      <Text color="#9E9E9E" typography="st13" fontWeight="regular">
                        {formatDate(post.createdAt)}
                      </Text>
                    )}
                  </div>

                  {/* Content Preview */}
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

                  {/* Stats */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Asset.Icon
                        frameShape={{ width: 18, height: 18 }}
                        backgroundColor="transparent"
                        name="icon-user-two-blue-tab"
                        aria-hidden={true}
                        ratio="1/1"
                      />
                      <Text color="#3182F6" typography="st13" fontWeight="medium">
                        {(post.guiltyCount || 0) + (post.innocentCount || 0)}
                      </Text>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Asset.Icon
                        frameShape={{ width: 18, height: 18 }}
                        backgroundColor="transparent"
                        name="icon-chat-square-two-mono"
                        color="#3182F6"
                        aria-hidden={true}
                        ratio="1/1"
                      />
                      <Text color="#3182F6" typography="st13" fontWeight="medium">
                        {post.commentCount ?? 0}
                      </Text>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default CompletedTrendingPage;
