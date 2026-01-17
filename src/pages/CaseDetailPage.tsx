import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Asset } from '@toss/tds-mobile';
import likeIcon from '../assets/좋아요_누기.png';
import replyIcon from '../assets/대댓글.png';

// Mock 데이터 (기본 게시물) - 모두 투표 종료 상태
const mockPosts: Record<string, { title: string; author: string; content: string; timestamp: string }> = {
  '1': {
    title: '37만원 헤드셋 살까 말까?',
    author: 'alstjs',
    content: '24살 대학생입니다. 현재 알바로 월에 50만원 정도 벌고 있는데, 몇 달 전부터 헤드셋이 계속 갖고 싶더라구요.. 운동하거나 공부할 때 ~~~',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3일 전 (투표 종료)
  },
  '2': {
    title: '배달비 5000원, 적당한가요?',
    author: 'toss_user',
    content: '배달비 인상에 대한 여러분의 의견을 들려주세요. 소비자와 자영업자 모두 상생할 방법은 없을까요?',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2일 전 (투표 종료)
  },
};

// localStorage에서 사용자가 작성한 게시물 가져오기
function getUserPost(postId: string): { title: string; author: string; content: string; timestamp: string } | null {
  try {
    const userPostsStr = localStorage.getItem('user_posts');
    if (userPostsStr) {
      const userPosts = JSON.parse(userPostsStr);
      const post = userPosts.find((p: any) => p.id === postId);
      if (post) {
        return {
          title: post.title,
          author: post.author,
          content: post.content,
          timestamp: post.timestamp || new Date().toISOString()
        };
      }
    }
  } catch (error) {
    console.error('사용자 게시물 로드 실패:', error);
  }
  return null;
}

interface Reply {
  id: string;
  author: string;
  authorId: string;
  content: string;
  likes: number;
  timestamp: string;
}

interface Comment {
  id: string;
  author: string;
  authorId: string;
  content: string;
  vote: 'agree' | 'disagree';
  likes: number;
  timestamp: string;
  replies: Reply[];
}

function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading, userData, logout } = useAuth();
  const [selectedVote, setSelectedVote] = useState<'agree' | 'disagree' | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'likes'>('latest');
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [voteStats, setVoteStats] = useState({ agree: 0, disagree: 0 });
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showMenuFor, setShowMenuFor] = useState<string | null>(null);
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [postAuthorId, setPostAuthorId] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);
  const [isVotingExpired, setIsVotingExpired] = useState(false);

  // Mock 게시물 또는 사용자 게시물 가져오기
  const post = id ? (mockPosts[id] || getUserPost(id)) : undefined;

  // 투표 가능 시간 계산 (48시간)
  useEffect(() => {
    if (!post?.timestamp) return;

    const calculateTimeRemaining = () => {
      const createdAt = new Date(post.timestamp).getTime();
      const now = Date.now();
      const votingPeriod = 48 * 60 * 60 * 1000; // 48시간
      const endTime = createdAt + votingPeriod;
      const remaining = endTime - now;

      if (remaining <= 0) {
        setIsVotingExpired(true);
        setTimeRemaining({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      setIsVotingExpired(false);
      setTimeRemaining({ hours, minutes, seconds });
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [post?.timestamp]);

  // 게시물 작성자 ID 가져오기
  useEffect(() => {
    if (id && !mockPosts[id]) {
      // 사용자가 작성한 게시물인 경우
      try {
        const userPostsStr = localStorage.getItem('user_posts');
        if (userPostsStr) {
          const userPosts = JSON.parse(userPostsStr);
          const foundPost = userPosts.find((p: any) => p.id === id);
          if (foundPost) {
            setPostAuthorId(foundPost.authorId);
          }
        }
      } catch (error) {
        console.error('게시물 작성자 확인 실패:', error);
      }
    }
  }, [id]);

  // localStorage 클리어 함수
  const clearLocalStorageForCase = (caseId: string) => {
    const keys = [
      `vote_${caseId}_`,
      `comments_${caseId}`,
      `liked_comments_${caseId}_`,
      `vote_stats_${caseId}`
    ];
    
    Object.keys(localStorage).forEach(key => {
      if (keys.some(prefix => key.startsWith(prefix) || key === prefix)) {
        console.log('🗑️ 손상된 데이터 삭제:', key);
        localStorage.removeItem(key);
      }
    });
  };

  // 첫 번째 게시물의 경우 세션당 한 번만 클리어 (손상된 데이터 복구)
  useEffect(() => {
    if (id === '1') {
      const sessionKey = 'case_1_cleared';
      const alreadyCleared = sessionStorage.getItem(sessionKey);
      
      if (!alreadyCleared) {
        console.log('🔧 첫 번째 게시물 - localStorage 초기 클리어 (한 번만)');
        clearLocalStorageForCase('1');
        sessionStorage.setItem(sessionKey, 'true');
      }
    }
  }, [id]);

  const handleLogout = async () => {
    try {
      await logout();
      alert('로그아웃되었습니다.');
      navigate('/');
    } catch (error) {
      console.error('로그아웃 오류:', error);
      alert('로그아웃에 실패했습니다.');
    }
  };

  const handleDeletePost = () => {
    if (!window.confirm('게시물을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const userPostsStr = localStorage.getItem('user_posts');
      if (userPostsStr) {
        const userPosts = JSON.parse(userPostsStr);
        const updatedPosts = userPosts.filter((p: any) => p.id !== id);
        localStorage.setItem('user_posts', JSON.stringify(updatedPosts));

        // 게시물 관련 모든 데이터 삭제
        localStorage.removeItem(`vote_stats_${id}`);
        localStorage.removeItem(`comments_${id}`);
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith(`vote_${id}_`) || key.startsWith(`liked_comments_${id}_`)) {
            localStorage.removeItem(key);
          }
        });

        alert('게시물이 삭제되었습니다.');
        navigate('/');
      }
    } catch (error) {
      console.error('게시물 삭제 실패:', error);
      alert('게시물 삭제에 실패했습니다.');
    }
  };

  const handleEditPost = () => {
    navigate(`/edit-post/${id}`);
  };

  // 페이지 로드 시 댓글, 투표 통계 확인 (로그인 여부 무관)
  useEffect(() => {
    if (!id) return;

    try {
      // 댓글 불러오기 (로그인 여부 무관)
      const commentsKey = `comments_${id}`;
      const savedComments = localStorage.getItem(commentsKey);
      if (savedComments) {
        try {
          const parsed = JSON.parse(savedComments);
          // 댓글 구조 검증
          if (Array.isArray(parsed)) {
            const validComments = parsed.filter(comment => 
              comment && 
              typeof comment === 'object' && 
              comment.id && 
              comment.author &&
              Array.isArray(comment.replies || [])
            );
            setComments(validComments);
          } else {
            throw new Error('Invalid comments format');
          }
        } catch (e) {
          console.error('댓글 데이터 파싱 실패 - 클리어:', e);
          clearLocalStorageForCase(id);
          setComments([]);
        }
      }

      // 투표 통계 불러오기 (로그인 여부 무관)
      const statsKey = `vote_stats_${id}`;
      const savedStats = localStorage.getItem(statsKey);
      if (savedStats) {
        try {
          const parsed = JSON.parse(savedStats);
          if (typeof parsed.agree === 'number' && typeof parsed.disagree === 'number') {
            setVoteStats(parsed);
          } else {
            throw new Error('Invalid stats format');
          }
        } catch (e) {
          console.error('투표 통계 데이터 파싱 실패:', e);
          localStorage.removeItem(statsKey);
          setVoteStats({ agree: 0, disagree: 0 });
        }
      }
    } catch (error) {
      console.error('❌ 데이터 로드 중 심각한 에러 - 전체 클리어:', error);
      clearLocalStorageForCase(id);
    }
  }, [id]);

  // 로그인 상태일 때 투표 여부, 좋아요한 댓글 확인
  useEffect(() => {
    if (id && user) {
      try {
        // 투표 여부 확인
        const voteKey = `vote_${id}_${user.uid}`;
        const votedData = localStorage.getItem(voteKey);
        if (votedData) {
          try {
            const { vote } = JSON.parse(votedData);
            setHasVoted(true);
            setSelectedVote(vote);
          } catch (e) {
            console.error('투표 데이터 파싱 실패:', e);
            localStorage.removeItem(voteKey);
          }
        }

        // 좋아요한 댓글 불러오기
        const likedKey = `liked_comments_${id}_${user.uid}`;
        const savedLiked = localStorage.getItem(likedKey);
        if (savedLiked) {
          try {
            const parsed = JSON.parse(savedLiked);
            setLikedComments(new Set(Array.isArray(parsed) ? parsed : []));
          } catch (e) {
            console.error('좋아요 데이터 파싱 실패:', e);
            localStorage.removeItem(likedKey);
            setLikedComments(new Set());
          }
        }
      } catch (error) {
        console.error('❌ 사용자 데이터 로드 중 에러:', error);
      }
    }
  }, [id, user]);

  // 인증 후 돌아왔을 때 사용자 정보가 로드될 때까지 대기
  useEffect(() => {
    if (!isLoading) {
      if (user && userData) {
        console.log('✅ 로그인 상태:', userData.nickname);
      } else {
        console.log('❌ 로그인 안 됨');
      }
    }
  }, [isLoading, user, userData]);

  const handleVoteSelect = (voteType: 'agree' | 'disagree') => {
    if (!hasVoted && !isVotingExpired) {
      setSelectedVote(voteType);
    }
  };

  const handleVoteClick = () => {
    if (isLoading) {
      return;
    }

    // 투표 시간 만료 확인
    if (isVotingExpired) {
      alert('투표 가능 시간이 종료되었습니다!');
      return;
    }
    
    // 로그인 상태 확인
    if (!user || !userData) {
      // 로그인되어 있지 않으면 약관 동의 페이지로 리다이렉트
      console.log('로그인 필요, 약관 페이지로 이동');
      navigate('/terms', { state: { from: location } });
      return;
    }

    // 이미 투표했는지 확인
    if (hasVoted) {
      alert('이미 투표했습니다!');
      return;
    }

    // 투표 선택 확인
    if (!selectedVote) {
      alert('합리적이다 또는 비합리적이다를 선택해주세요!');
      return;
    }
    
    // 투표 처리
    const voteKey = `vote_${id}_${user.uid}`;
    const voteData = {
      vote: selectedVote,
      timestamp: new Date().toISOString(),
      caseId: id,
      userId: user.uid
    };
    localStorage.setItem(voteKey, JSON.stringify(voteData));
    setHasVoted(true);

    // 투표 통계 업데이트
    const statsKey = `vote_stats_${id}`;
    const newStats = {
      agree: selectedVote === 'agree' ? voteStats.agree + 1 : voteStats.agree,
      disagree: selectedVote === 'disagree' ? voteStats.disagree + 1 : voteStats.disagree
    };
    setVoteStats(newStats);
    localStorage.setItem(statsKey, JSON.stringify(newStats));

    const voteText = selectedVote === 'agree' ? '합리적이다' : '비합리적이다';
    alert(`"${voteText}"로 투표가 완료되었습니다!`);
    console.log('투표 완료:', voteData);
  };

  const handleCommentSubmit = () => {
    if (!user || !userData) {
      alert('로그인이 필요합니다.');
      navigate('/terms', { state: { from: location } });
      return;
    }

    if (!hasVoted) {
      alert('투표를 먼저 해주세요!');
      return;
    }

    if (!newComment.trim()) {
      alert('댓글 내용을 입력해주세요!');
      return;
    }

    const comment: Comment = {
      id: `${Date.now()}_${Math.random()}`,
      author: userData.nickname,
      authorId: user.uid,
      content: newComment,
      vote: selectedVote!,
      likes: 0,
      timestamp: new Date().toISOString(),
      replies: []
    };

    const updatedComments = [...comments, comment];
    setComments(updatedComments);
    setNewComment('');

    // 댓글 저장
    const commentsKey = `comments_${id}`;
    localStorage.setItem(commentsKey, JSON.stringify(updatedComments));
  };

  const handleLikeComment = (commentId: string) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (likedComments.has(commentId)) {
      alert('이미 공감한 댓글입니다!');
      return;
    }

    // 댓글 좋아요 증가
    const updatedComments = comments.map(comment =>
      comment.id === commentId
        ? { ...comment, likes: comment.likes + 1 }
        : comment
    );
    setComments(updatedComments);

    // 좋아요한 댓글 저장
    const newLikedComments = new Set(likedComments);
    newLikedComments.add(commentId);
    setLikedComments(newLikedComments);

    // localStorage에 저장
    const commentsKey = `comments_${id}`;
    localStorage.setItem(commentsKey, JSON.stringify(updatedComments));
    
    const likedKey = `liked_comments_${id}_${user.uid}`;
    localStorage.setItem(likedKey, JSON.stringify(Array.from(newLikedComments)));
  };

  const handleReplySubmit = (commentId: string) => {
    if (!user || !userData) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (!replyContent.trim()) {
      alert('답글 내용을 입력해주세요!');
      return;
    }

    const reply: Reply = {
      id: `reply_${Date.now()}_${Math.random()}`,
      author: userData.nickname,
      authorId: user.uid,
      content: replyContent,
      likes: 0,
      timestamp: new Date().toISOString()
    };

    const updatedComments = comments.map(comment =>
      comment.id === commentId
        ? { ...comment, replies: [...comment.replies, reply] }
        : comment
    );
    setComments(updatedComments);
    setReplyContent('');
    setReplyingTo(null);

    // localStorage에 저장
    const commentsKey = `comments_${id}`;
    localStorage.setItem(commentsKey, JSON.stringify(updatedComments));
  };

  const handleLikeReply = (commentId: string, replyId: string) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    const likeKey = `${commentId}_${replyId}`;
    if (likedComments.has(likeKey)) {
      alert('이미 공감한 답글입니다!');
      return;
    }

    // 답글 좋아요 증가
    const updatedComments = comments.map(comment =>
      comment.id === commentId
        ? {
            ...comment,
            replies: comment.replies.map(reply =>
              reply.id === replyId
                ? { ...reply, likes: reply.likes + 1 }
                : reply
            )
          }
        : comment
    );
    setComments(updatedComments);

    // 좋아요한 답글 저장
    const newLikedComments = new Set(likedComments);
    newLikedComments.add(likeKey);
    setLikedComments(newLikedComments);

    // localStorage에 저장
    const commentsKey = `comments_${id}`;
    localStorage.setItem(commentsKey, JSON.stringify(updatedComments));
    
    const likedKey = `liked_comments_${id}_${user.uid}`;
    localStorage.setItem(likedKey, JSON.stringify(Array.from(newLikedComments)));
  };

  const handleEditComment = (commentId: string) => {
    if (!editContent.trim()) {
      alert('댓글 내용을 입력해주세요!');
      return;
    }

    const updatedComments = comments.map(comment =>
      comment.id === commentId
        ? { ...comment, content: editContent }
        : comment
    );
    setComments(updatedComments);
    setEditingComment(null);
    setEditContent('');

    // localStorage에 저장
    const commentsKey = `comments_${id}`;
    localStorage.setItem(commentsKey, JSON.stringify(updatedComments));
  };

  const handleDeleteComment = (commentId: string) => {
    if (window.confirm('댓글을 삭제하시겠습니까?')) {
      const updatedComments = comments.filter(comment => comment.id !== commentId);
      setComments(updatedComments);

      // localStorage에 저장
      const commentsKey = `comments_${id}`;
      localStorage.setItem(commentsKey, JSON.stringify(updatedComments));
    }
  };

  const handleReportComment = () => {
    alert('신고가 접수되었습니다.');
    setShowMenuFor(null);
  };

  // 댓글 정렬
  const sortedComments = [...comments].sort((a, b) => {
    if (sortBy === 'latest') {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    } else {
      return b.likes - a.likes;
    }
  });

  // 투표 통계 계산
  const totalVotes = voteStats.agree + voteStats.disagree;
  const agreePercent = totalVotes > 0 ? Math.round((voteStats.agree / totalVotes) * 100) : 50;
  const disagreePercent = totalVotes > 0 ? Math.round((voteStats.disagree / totalVotes) * 100) : 50;

  if (!post) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>게시물을 찾을 수 없습니다.</p>
        <button onClick={() => navigate('/')} style={{ marginTop: '20px', padding: '10px 20px' }}>
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      backgroundColor: '#F8F9FA', 
      minHeight: '100vh', 
      paddingBottom: '24px',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* 헤더 */}
      <div style={{ 
        padding: '16px 20px', 
        backgroundColor: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <button 
          onClick={() => {
            const fromTab = (location.state as any)?.fromTab || '재판 중';
            navigate('/', { state: { selectedTab: fromTab } });
          }}
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
            frameShape={Asset.frameShape.CleanW20}
            name="icon-arrow-left-mono"
            color="rgba(0, 19, 43, 0.58)"
            aria-label="뒤로가기"
          />
        </button>
        <div style={{ position: 'relative' }}>
          {user && userData && (
            <>
              <button 
                onClick={() => setShowPostMenu(!showPostMenu)}
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
                  aria-label="메뉴"
                />
              </button>
              
              {/* 메뉴 드롭다운 */}
              {showPostMenu && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  zIndex: 1000,
                  minWidth: '120px'
                }}>
                  {user?.uid === postAuthorId ? (
                    <>
                      <button
                        onClick={() => {
                          handleEditPost();
                          setShowPostMenu(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: 'none',
                          background: 'none',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: '#191F28'
                        }}
                      >
                        수정
                      </button>
                      <button
                        onClick={() => {
                          handleDeletePost();
                          setShowPostMenu(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: 'none',
                          background: 'none',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: '#D32F2F'
                        }}
                      >
                        삭제
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        handleLogout();
                        setShowPostMenu(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: 'none',
                        background: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#191F28'
                      }}
                    >
                      로그아웃
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ height: '16px' }} />

      {/* 게시글 내용 */}
      <div style={{ padding: '0 20px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ 
          backgroundColor: 'white', 
          padding: '20px', 
          borderRadius: '12px',
          width: '100%',
          boxSizing: 'border-box',
          maxWidth: '100%',
          overflow: 'hidden'
        }}>
          {/* 프로필 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Asset.Icon
              frameShape={Asset.frameShape.CleanW40}
              backgroundColor="transparent"
              name="icon-one-league10-blue"
              aria-hidden={true}
            />
            <span style={{ color: '#666', fontSize: '13px' }}>
              익명 {post.author} 님
            </span>
          </div>

          {/* 제목 */}
          <h2 style={{ 
            color: '#191F28', 
            fontSize: '20px', 
            fontWeight: '700', 
            marginBottom: '12px',
            margin: '0 0 12px 0',
            wordBreak: 'break-word',
            overflowWrap: 'break-word'
          }}>
            {post.title}
          </h2>

          {/* 내용 */}
          <p style={{ 
            color: '#191F28', 
            fontSize: '15px', 
            fontWeight: '400', 
            marginBottom: '20px',
            lineHeight: '1.6',
            margin: '0 0 20px 0',
            wordBreak: 'break-word',
            overflowWrap: 'break-word'
          }}>
            {post.content}
          </p>

          {/* 투표 버튼들 */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <button 
              onClick={() => handleVoteSelect('agree')}
              disabled={hasVoted || isVotingExpired}
              style={{ 
                flex: 1, 
                padding: '12px', 
                backgroundColor: '#E3F2FD',
                color: '#1976D2',
                border: selectedVote === 'agree' ? '3px solid #1976D2' : 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: (hasVoted || isVotingExpired) ? 'not-allowed' : 'pointer',
                opacity: (hasVoted && selectedVote !== 'agree') || isVotingExpired ? 0.5 : 1
              }}
            >
              합리적이다
            </button>
            <button 
              onClick={() => handleVoteSelect('disagree')}
              disabled={hasVoted || isVotingExpired}
              style={{ 
                flex: 1, 
                padding: '12px', 
                backgroundColor: '#FFEBEE',
                color: '#D32F2F',
                border: selectedVote === 'disagree' ? '3px solid #D32F2F' : 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: (hasVoted || isVotingExpired) ? 'not-allowed' : 'pointer',
                opacity: (hasVoted && selectedVote !== 'disagree') || isVotingExpired ? 0.5 : 1
              }}
            >
              비합리적이다
            </button>
          </div>

          {/* 투표하기 버튼 */}
          <button
            onClick={handleVoteClick}
            disabled={isLoading || hasVoted || isVotingExpired}
            style={{ 
              width: '100%',
              padding: '16px',
              backgroundColor: (isLoading || hasVoted || isVotingExpired) ? '#ccc' : '#3182F6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: (isLoading || hasVoted || isVotingExpired) ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? '로딩 중...' : isVotingExpired ? '투표 시간 종료' : hasVoted ? '투표 완료' : '투표하기'}
          </button>

          {timeRemaining && !isVotingExpired && (
            <div style={{ 
              marginTop: '12px', 
              textAlign: 'center',
              fontSize: '15px',
              color: '#191F28',
              fontWeight: '500'
            }}>
              {`남은 투표 시간 : ${String(timeRemaining.hours).padStart(2, '0')} : ${String(timeRemaining.minutes).padStart(2, '0')} : ${String(timeRemaining.seconds).padStart(2, '0')}`}
            </div>
          )}
        </div>
      </div>

      {/* 투표 결과 */}
      {hasVoted && totalVotes > 0 && (
        <>
          <div style={{ height: '16px' }} />
          <div style={{ padding: '0 20px', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ 
              backgroundColor: 'white', 
              padding: '20px', 
              borderRadius: '12px',
              width: '100%',
              boxSizing: 'border-box',
              maxWidth: '100%',
              overflow: 'hidden'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                marginBottom: '12px'
              }}>
                <span style={{ color: '#1976D2', fontSize: '18px', fontWeight: '700' }}>
                  {agreePercent}%
                </span>
                <span style={{ color: '#666', fontSize: '14px' }}>
                  {totalVotes}명 투표 중
                </span>
                <span style={{ color: '#D32F2F', fontSize: '18px', fontWeight: '700' }}>
                  {disagreePercent}%
                </span>
              </div>
              <div style={{ 
                display: 'flex', 
                height: '8px', 
                borderRadius: '4px',
                overflow: 'hidden',
                backgroundColor: '#f0f0f0'
              }}>
                <div style={{ 
                  width: `${agreePercent}%`, 
                  backgroundColor: '#1976D2'
                }} />
                <div style={{ 
                  width: `${disagreePercent}%`, 
                  backgroundColor: '#D32F2F'
                }} />
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                marginTop: '8px'
              }}>
                <span style={{ color: '#666', fontSize: '13px' }}>합리적이다</span>
                <span style={{ color: '#666', fontSize: '13px' }}>비합리적이다</span>
              </div>
            </div>
          </div>
        </>
      )}

      <div style={{ height: '16px' }} />

      {/* 댓글 섹션 */}
      <div style={{ padding: '0 20px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ 
          backgroundColor: 'white', 
          padding: '20px', 
          borderRadius: '12px',
          width: '100%',
          boxSizing: 'border-box',
          maxWidth: '100%',
          overflow: 'hidden'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <h4 style={{ 
              color: '#191F28', 
              fontSize: '17px', 
              fontWeight: '600',
              margin: 0
            }}>
              전체 댓글 {comments.length}
            </h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setSortBy('latest')}
                style={{
                  padding: '6px 12px',
                  backgroundColor: sortBy === 'latest' ? '#3182F6' : 'transparent',
                  color: sortBy === 'latest' ? 'white' : '#666',
                  border: '1px solid #ddd',
                  borderRadius: '16px',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                최신순
              </button>
              <button
                onClick={() => setSortBy('likes')}
                style={{
                  padding: '6px 12px',
                  backgroundColor: sortBy === 'likes' ? '#3182F6' : 'transparent',
                  color: sortBy === 'likes' ? 'white' : '#666',
                  border: '1px solid #ddd',
                  borderRadius: '16px',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                공감순
              </button>
            </div>
          </div>

          {/* 댓글 작성 */}
          {user && userData && hasVoted ? (
            <div style={{ marginBottom: '20px' }}>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="의견을 남겨주세요..."
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
              <button
                onClick={handleCommentSubmit}
                style={{
                  marginTop: '8px',
                  padding: '10px 20px',
                  backgroundColor: '#3182F6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  float: 'right'
                }}
              >
                댓글 작성
              </button>
              <div style={{ clear: 'both' }} />
            </div>
          ) : user && userData && !hasVoted && !isVotingExpired ? (
            <div style={{ 
              marginBottom: '20px',
              padding: '16px',
              backgroundColor: '#FFF4E5',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <p style={{ 
                color: '#191F28', 
                fontSize: '14px',
                margin: 0 
              }}>
                💬 투표 후 댓글을 작성할 수 있습니다
              </p>
            </div>
          ) : null}

          {/* 댓글 목록 */}
          {sortedComments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {sortedComments.map((comment) => (
                <div key={comment.id}>
                  {/* 댓글 */}
                  <div 
                    style={{
                      padding: '12px 16px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '8px',
                      position: 'relative',
                      display: 'flex',
                      gap: '12px'
                    }}
                  >
                    {/* 왼쪽: 무죄/유죄 배지 */}
                    <div style={{
                      padding: '6px 10px',
                      backgroundColor: comment.vote === 'agree' ? '#E3F2FD' : '#FFEBEE',
                      color: comment.vote === 'agree' ? '#1976D2' : '#D32F2F',
                      fontSize: '13px',
                      fontWeight: '600',
                      borderRadius: '6px',
                      height: 'fit-content',
                      whiteSpace: 'nowrap'
                    }}>
                      {comment.vote === 'agree' ? '무죄' : '유죄'}
                    </div>

                    {/* 오른쪽: 내용 영역 */}
                    <div style={{ flex: 1 }}>
                      {/* 상단: 작성자 + 우측 버튼들 */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '6px'
                      }}>
                        <span style={{ 
                          color: '#191F28', 
                          fontSize: '14px',
                          fontWeight: '600'
                        }}>
                          {comment.author}
                        </span>
                        
                        {/* 우측 버튼들 - 가로 배치 */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            onClick={() => handleLikeComment(comment.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '13px',
                              color: likedComments.has(comment.id) ? '#3182F6' : '#666',
                              padding: '0',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <img 
                              src={likeIcon} 
                              alt="좋아요" 
                              style={{ 
                                width: '18px', 
                                height: '18px',
                                objectFit: 'contain'
                              }} 
                            />
                            <span style={{ fontSize: '12px' }}>{comment.likes}</span>
                          </button>
                          <button
                            onClick={() => setReplyingTo(comment.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '13px',
                              color: '#666',
                              padding: '0',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <img 
                              src={replyIcon} 
                              alt="댓글" 
                              style={{ 
                                width: '18px', 
                                height: '18px',
                                objectFit: 'contain'
                              }} 
                            />
                          </button>
                          <button
                            onClick={() => setShowMenuFor(showMenuFor === comment.id ? null : comment.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '13px',
                              color: '#666',
                              padding: '0'
                            }}
                          >
                            ⋯
                          </button>
                        </div>
                      </div>

                      {/* 댓글 내용 또는 수정 폼 */}
                      {editingComment === comment.id ? (
                        <div>
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            style={{
                              width: '100%',
                              minHeight: '60px',
                              padding: '8px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '14px',
                              marginBottom: '8px',
                              boxSizing: 'border-box'
                            }}
                          />
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => {
                                setEditingComment(null);
                                setEditContent('');
                              }}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#f0f0f0',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '13px'
                              }}
                            >
                              취소
                            </button>
                            <button
                              onClick={() => handleEditComment(comment.id)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#3182F6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '13px'
                              }}
                            >
                              수정
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p style={{ 
                          color: '#191F28', 
                          fontSize: '14px',
                          margin: '0',
                          lineHeight: '1.4'
                        }}>
                          {comment.content}
                        </p>
                      )}

                      {/* 답글 작성 폼 */}
                      {replyingTo === comment.id && (
                        <div style={{ marginTop: '12px' }}>
                          <textarea
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            placeholder="답글을 입력하세요..."
                            style={{
                              width: '100%',
                              minHeight: '60px',
                              padding: '8px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '13px',
                              marginBottom: '8px',
                              boxSizing: 'border-box'
                            }}
                          />
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => {
                                setReplyingTo(null);
                                setReplyContent('');
                              }}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#f0f0f0',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '13px'
                              }}
                            >
                              취소
                            </button>
                            <button
                              onClick={() => handleReplySubmit(comment.id)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#3182F6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '13px'
                              }}
                            >
                              답글 작성
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 더보기 메뉴 */}
                    {showMenuFor === comment.id && (
                      <div style={{
                        position: 'absolute',
                        top: '50px',
                        right: '16px',
                        backgroundColor: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        zIndex: 10,
                        minWidth: '100px'
                      }}>
                        {user?.uid === comment.authorId ? (
                          <>
                            <button
                              onClick={() => {
                                setEditingComment(comment.id);
                                setEditContent(comment.content);
                                setShowMenuFor(null);
                              }}
                              style={{
                                width: '100%',
                                padding: '12px',
                                border: 'none',
                                background: 'none',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontSize: '14px'
                              }}
                            >
                              수정
                            </button>
                            <button
                              onClick={() => {
                                handleDeleteComment(comment.id);
                                setShowMenuFor(null);
                              }}
                              style={{
                                width: '100%',
                                padding: '12px',
                                border: 'none',
                                background: 'none',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontSize: '14px',
                                color: '#D32F2F'
                              }}
                            >
                              삭제
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={handleReportComment}
                            style={{
                              width: '100%',
                              padding: '12px',
                              border: 'none',
                              background: 'none',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '14px',
                              color: '#D32F2F'
                            }}
                          >
                            신고하기
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 답글 목록 */}
                  {comment.replies.length > 0 && (
                    <div style={{ marginLeft: '32px', marginTop: '8px' }}>
                      {comment.replies.map((reply) => (
                        <div
                          key={reply.id}
                          style={{
                            padding: '10px 12px',
                            backgroundColor: '#fff',
                            borderRadius: '8px',
                            marginBottom: '8px',
                            border: '1px solid #e0e0e0',
                            display: 'flex',
                            gap: '10px'
                          }}
                        >
                          {/* 왼쪽: 답글 아이콘 */}
                          <div style={{
                            padding: '4px 8px',
                            backgroundColor: '#F0F0F0',
                            color: '#666',
                            fontSize: '12px',
                            fontWeight: '600',
                            borderRadius: '4px',
                            height: 'fit-content',
                            whiteSpace: 'nowrap'
                          }}>
                            ↳
                          </div>

                          {/* 오른쪽: 내용 영역 */}
                          <div style={{ flex: 1 }}>
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              marginBottom: '6px'
                            }}>
                              <span style={{ 
                                color: '#191F28', 
                                fontSize: '13px',
                                fontWeight: '600'
                              }}>
                                {reply.author}
                              </span>
                              <button
                                onClick={() => handleLikeReply(comment.id, reply.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  color: likedComments.has(`${comment.id}_${reply.id}`) ? '#3182F6' : '#666',
                                  padding: '0',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <img 
                                  src={likeIcon} 
                                  alt="좋아요" 
                                  style={{ 
                                    width: '18px', 
                                    height: '18px',
                                    objectFit: 'contain'
                                  }} 
                                />
                                <span>{reply.likes}</span>
                              </button>
                            </div>
                            <p style={{ 
                              color: '#191F28', 
                              fontSize: '13px',
                              margin: '0',
                              lineHeight: '1.4'
                            }}>
                              {reply.content}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CaseDetailPage;
