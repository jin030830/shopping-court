import { useNavigate } from 'react-router-dom';
import { Asset, Text, Spacing } from '@toss/tds-mobile';
import { useState, useEffect } from 'react';
import { getAllCases, getComments, getReplies, type CaseDocument } from '../api/cases';
import { Timestamp } from 'firebase/firestore';
import { adaptive } from '@toss/tds-colors';
import { useAuth } from '../hooks/useAuth';

function MyPostsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [allPosts, setAllPosts] = useState<CaseDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [postsWithDetails, setPostsWithDetails] = useState<any[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        setIsLoading(true);
        const cases = await getAllCases();
        // 현재 사용자가 작성한 게시물만 필터링
        const myPosts = cases.filter(post => post.authorId === user?.uid);
        setAllPosts(myPosts);
      } catch (err) {
        console.error('게시물 로드 실패:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.uid) {
      fetchCases();
    }
  }, [user?.uid]);

  useEffect(() => {
    const loadPostDetails = async () => {
      setIsLoadingDetails(true);
      try {
        const postsWithData = await Promise.all(
          allPosts.map(async (post) => {
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
            
            const voteCount = (post.guiltyCount || 0) + (post.innocentCount || 0);
            
            return {
              ...post,
              commentCount: actualCommentCount,
              voteCount
            };
          })
        );
        
        setPostsWithDetails(postsWithData);
      } catch (error) {
        console.error('게시물 상세 정보 처리 실패:', error);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    if (allPosts.length > 0) {
      loadPostDetails();
    } else {
      setIsLoadingDetails(false);
    }
  }, [allPosts]);

  // 재판 중인 글 (status === 'OPEN')
  const inProgressPosts = postsWithDetails.filter(post => {
    if (post.status !== 'OPEN') return false;
    // 제목이 "0"이거나 공백만 있거나 빈 문자열인 경우 제외
    const title = (post.title && typeof post.title === 'string') ? post.title.trim() : '';
    return title !== '' && title !== '0';
  });
  
  // 이전 재판 기록 (status === 'CLOSED')
  const completedPosts = postsWithDetails.filter(post => post.status === 'CLOSED');

  const formatDate = (timestamp: Timestamp | undefined) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')} ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const renderPostItem = (post: any, showVerdict: boolean = false) => {
    // 재판 완료된 글의 경우 verdict 계산
    let verdict: '무죄' | '유죄' | '보류' = '보류';
    if (showVerdict && post.status === 'CLOSED') {
      const innocentCount = post.innocentCount || 0;
      const guiltyCount = post.guiltyCount || 0;
      if (innocentCount > guiltyCount) {
        verdict = '무죄';
      } else if (guiltyCount > innocentCount) {
        verdict = '유죄';
      } else {
        verdict = '보류';
      }
    }
    
    const badgeBgColor = verdict === '무죄' ? '#E3F2FD' : verdict === '유죄' ? '#FFEBEE' : '#F2F4F6';
    const badgeTextColor = verdict === '무죄' ? '#1976D2' : verdict === '유죄' ? '#D32F2F' : '#6B7684';

    return (
      <div
        key={post.id}
        onClick={() => navigate(`/case/${post.id}`, { state: { fromTab: '내가 쓴 글' } })}
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #F0F0F0',
          cursor: 'pointer',
          backgroundColor: 'white'
        }}
      >
        {/* Verdict Badge - 재판 완료된 글에만 표시 */}
        {showVerdict && post.status === 'CLOSED' && (
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
        )}

        {/* 제목과 날짜 */}
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

        {/* 내용 미리보기 */}
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

        {/* 통계 */}
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
              {post.voteCount || 0}
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
  };

  return (
    <div style={{ 
      backgroundColor: 'white', 
      minHeight: '100vh',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* Header with gradient background */}
      <div style={{ 
        padding: '0 20px', 
        marginBottom: '0px',
        background: 'linear-gradient(180deg, #F7F3EEff 0%, #ffffff 100%)',
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
              color="#191F28" 
              typography="t3" 
              fontWeight="bold"
              style={{ marginBottom: '8px', fontSize: '22px' }}
            >
              내가 쓴 글
            </Text>
            <Text 
              display="block" 
              color="#191F28" 
              typography="t7" 
              fontWeight="regular"
              style={{ marginBottom: '0px' }}
            >
              내가 참여한 재판 현황을 한눈에 확인하세요
            </Text>
          </div>
        </div>
      </div>

      <Spacing size={24} />

      {/* 재판 중인 글 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 20px', marginBottom: '16px' }}>
          <Asset.Image
            frameShape={Asset.frameShape.CleanW24}
            backgroundColor="transparent"
            src="https://static.toss.im/2d-emojis/png/4x/u2696.png"
            aria-hidden={true}
            style={{ aspectRatio: '1/1', width: '28px', height: '28px' }}
          />
          <Text color={adaptive.grey800} typography="t4" fontWeight="bold" style={{ fontSize: '20px' }}>
            재판 중인 글
          </Text>
        </div>

        {isLoading || isLoadingDetails ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <Text color="#6B7684">게시물을 불러오는 중...</Text>
          </div>
        ) : inProgressPosts.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <Text color="#6B7684">재판 중인 글이 없습니다.</Text>
          </div>
        ) : (
          <>
            {!isLoading && !isLoadingDetails && inProgressPosts.length > 0 && (
              <div style={{ 
                height: '1px', 
                backgroundColor: '#F0F0F0', 
                marginBottom: '0px',
                width: '100%'
              }} />
            )}
            {inProgressPosts.map(post => renderPostItem(post, false))}
          </>
        )}
      </div>

      <Spacing size={32} />

      {/* 이전 재판 기록 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 20px', marginBottom: '16px' }}>
          <Asset.Icon
            frameShape={Asset.frameShape.CleanW24}
            backgroundColor="transparent"
            name="icon-check-circle-mono"
            color="#5e403b"
            aria-hidden={true}
            ratio="1/1"
          />
          <Text color={adaptive.grey800} typography="t4" fontWeight="bold" style={{ fontSize: '20px' }}>
            이전 재판 기록
          </Text>
        </div>

        {isLoading || isLoadingDetails ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <Text color="#6B7684">게시물을 불러오는 중...</Text>
          </div>
        ) : completedPosts.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <Text color="#6B7684">이전 재판 기록이 없습니다.</Text>
          </div>
        ) : (
          <>
            {!isLoading && !isLoadingDetails && completedPosts.length > 0 && (
              <div style={{ 
                height: '1px', 
                backgroundColor: '#F0F0F0', 
                marginBottom: '0px',
                width: '100%'
              }} />
            )}
            {completedPosts.map(post => renderPostItem(post, true))}
          </>
        )}
      </div>

      <Spacing size={32} />
    </div>
  );
}

export default MyPostsPage;
