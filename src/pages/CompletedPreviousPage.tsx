import { useNavigate } from 'react-router-dom';
import { Asset, Text, Spacing } from '@toss/tds-mobile';
import { useState, useEffect } from 'react';
import { getAllCases, type CaseDocument } from '../api/cases';
import { Timestamp } from 'firebase/firestore';
import { adaptive } from '@toss/tds-colors';

function CompletedPreviousPage() {
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
    const loadPostDetails = () => {
      setIsLoadingDetails(true);
      try {
        const postsWithData = allPosts
          .filter(post => post.status === 'CLOSED')
          .map((post) => {
            const voteCount = (post.guiltyCount || 0) + (post.innocentCount || 0);
            
            // 트리거로 관리되는 commentCount 사용
            const actualCommentCount = post.commentCount || 0;
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
          });
        
        // 모든 CLOSED 상태의 게시물을 완료일 최신순으로 정렬
        const sortedPosts = postsWithData
          .sort((a, b) => {
            const dateA = a.voteEndAt?.toMillis() || 0;
            const dateB = b.voteEndAt?.toMillis() || 0;
            return dateB - dateA;
          });
        
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
      <div style={{ padding: '0 20px', paddingTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
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
          typography="t3"
          fontWeight="bold"
          style={{ fontSize: '22px' }}
        >
          이전 재판 기록
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
      <div style={{ padding: '0 20px', marginBottom: '8px', display: 'flex', gap: '8px' }}>
        {(['전체', '무죄', '유죄', '보류'] as const).map((filterOption) => (
          <button
            key={filterOption}
            onClick={() => setFilter(filterOption)}
            style={{
              padding: '6px 16px',
              backgroundColor: filter === filterOption ? '#191F28' : '#F2F4F6',
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

      <Spacing size={8} />

      {/* Post List */}
      <div style={{ backgroundColor: 'white' }}>
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
                {index === 0 && (
                  <div style={{ 
                    height: '1px', 
                    backgroundColor: '#F0F0F0', 
                    width: '100%'
                  }} />
                )}
                <div
                  onClick={() => navigate(`/case/${post.id}`, { state: { fromTab: '재판 완료' } })}
                  style={{
                    backgroundColor: 'white',
                    padding: '16px 20px',
                    borderTop: 'none',
                    borderBottom: '1px solid #F0F0F0',
                    cursor: 'pointer'
                  }}
                >
                  {/* Verdict Badge와 날짜 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{
                      padding: '4px 10px',
                      backgroundColor: badgeBgColor,
                      color: badgeTextColor,
                      fontSize: '12px',
                      fontWeight: '600',
                      borderRadius: '4px',
                      whiteSpace: 'nowrap',
                      minWidth: 'fit-content',
                      display: 'inline-block'
                    }}>
                      {verdict}
                    </div>
                    {post.createdAt && (
                      <Text color="#9E9E9E" typography="st13" fontWeight="regular" style={{ flexShrink: 0, whiteSpace: 'nowrap', fontSize: '14px' }}>
                        {formatDate(post.createdAt)}
                      </Text>
                    )}
                  </div>

                  {/* Title */}
                  <div style={{ marginBottom: '4px' }}>
                    <Text 
                      display="block" 
                      color="#191F28" 
                      typography="t4" 
                      fontWeight="bold"
                      style={{ 
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
                  </div>

                  {/* Content Preview */}
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

                  {/* Stats */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Asset.Icon
                        frameShape={{ width: 15, height: 15 }}
                        backgroundColor="transparent"
                        name="icon-user-two-mono"
                        color="#5e403b"
                        aria-hidden={true}
                        ratio="1/1"
                      />
                      <Text color="#5e403b" typography="st13" fontWeight="medium" style={{ fontSize: '14px' }}>
                        {(post.guiltyCount || 0) + (post.innocentCount || 0)}
                      </Text>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Asset.Icon
                        frameShape={{ width: 15, height: 15 }}
                        backgroundColor="transparent"
                        name="icon-chat-bubble-mono"
                        color="#5E403Bff"
                        aria-hidden={true}
                        ratio="1/1"
                      />
                      <Text color="#5e403b" typography="st13" fontWeight="medium" style={{ fontSize: '14px' }}>
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

export default CompletedPreviousPage;
