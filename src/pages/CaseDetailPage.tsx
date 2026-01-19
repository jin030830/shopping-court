import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Asset } from '@toss/tds-mobile';
import likeIcon from '../assets/좋아요_누기.png';
import replyIcon from '../assets/대댓글.png';
import replyArrowIcon from '../assets/답글화살표.png';
import { 
  getCase, 
  getUserVote, 
  addVote, 
  getComments, 
  getReplies,
  addComment, 
  addCommentLike,
  addReplyLike,
  addReply,
  updateComment,
  deleteComment,
  updateReply,
  deleteReply,
  deleteCase,
  type CaseDocument,
  type CommentDocument,
  type ReplyDocument,
  type VoteType
} from '../api/cases';

// Comment with replies for UI
interface CommentWithReplies extends CommentDocument {
  replies: ReplyDocument[];
}

function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading, userData, logout } = useAuth();
  const [selectedVote, setSelectedVote] = useState<'agree' | 'disagree' | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [newComment, setNewComment] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'likes'>('latest');
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [post, setPost] = useState<CaseDocument | null>(null);
  const [isLoadingPost, setIsLoadingPost] = useState(true);

  // 게시물 로딩
  useEffect(() => {
    const loadPost = async () => {
      if (!id) return;
      setIsLoadingPost(true);
      try {
        const caseData = await getCase(id);
        if (caseData) {
          setPost(caseData);
        } else {
          setPost(null);
        }
      } catch (error) {
        console.error('게시물 로딩 실패:', error);
        setPost(null);
      } finally {
        setIsLoadingPost(false);
      }
    };
    loadPost();
  }, [id]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showMenuFor, setShowMenuFor] = useState<string | null>(null);
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);
  const [isVotingExpired, setIsVotingExpired] = useState(false);
  const [editingReply, setEditingReply] = useState<string | null>(null);
  const [editReplyContent, setEditReplyContent] = useState('');
  const [showMenuForReply, setShowMenuForReply] = useState<string | null>(null);

  // 투표 가능 시간 계산 (48시간)
  useEffect(() => {
    if (!post?.voteEndAt) return;

    const calculateTimeRemaining = () => {
      const endTime = post.voteEndAt!.toMillis();
      const now = Date.now();
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
  }, [post?.voteEndAt]);



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

  const handleDeletePost = async () => {
    if (!window.confirm('게시물을 삭제하시겠습니까?')) {
      return;
    }

    try {
      if (!id) return;
      await deleteCase(id);

      alert('게시물이 삭제되었습니다.');
      navigate('/');
    } catch (error) {
      console.error('게시물 삭제 실패:', error);
      alert('게시물 삭제에 실패했습니다.');
    }
  };

  const handleEditPost = () => {
    navigate(`/edit-post/${id}`);
  };

  // 댓글 로딩
  useEffect(() => {
    const loadComments = async () => {
      if (!id) return;

      try {
        const commentsData = await getComments(id);
        const commentsWithReplies: CommentWithReplies[] = await Promise.all(
          commentsData.map(async (comment) => {
            const replies = await getReplies(id, comment.id);
            return { ...comment, replies };
          })
        );
        setComments(commentsWithReplies);
      } catch (error) {
        console.error('댓글 로딩 실패:', error);
        setComments([]);
      }
    };
    loadComments();
  }, [id]);

  // 투표 여부 확인
  useEffect(() => {
    const loadUserVote = async () => {
      if (!id || !user) return;

      try {
        const userVote = await getUserVote(id, user.uid);
        if (userVote) {
          setHasVoted(true);
          // Firebase의 'innocent'/'guilty'를 UI의 'agree'/'disagree'로 변환
          setSelectedVote(userVote.vote === 'innocent' ? 'agree' : 'disagree');
        }
      } catch (error) {
        console.error('투표 로딩 실패:', error);
      }
    };
    loadUserVote();
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

  const handleVoteClick = async () => {
    if (isLoading || !id) {
      return;
    }

    // 투표 시간 만료 확인
    if (isVotingExpired) {
      alert('투표 가능 시간이 종료되었습니다!');
      return;
    }
    
    // 로그인 상태 확인
    if (!user || !userData) {
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
    
    try {
      // UI의 'agree'/'disagree'를 Firebase의 'innocent'/'guilty'로 변환
      const firebaseVote: VoteType = selectedVote === 'agree' ? 'innocent' : 'guilty';
      await addVote(id, user.uid, firebaseVote);
      
      setHasVoted(true);
      
      // 게시물 데이터 다시 로딩하여 통계 업데이트
      const updatedPost = await getCase(id);
      if (updatedPost) {
        setPost(updatedPost);
      }

      const voteText = selectedVote === 'agree' ? '합리적이다' : '비합리적이다';
      alert(`"${voteText}"로 투표가 완료되었습니다!`);
    } catch (error) {
      console.error('투표 실패:', error);
      alert('투표에 실패했습니다.');
    }
  };

  const handleCommentSubmit = async () => {
    if (!id || !user || !userData) {
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

    try {
      // UI의 'agree'/'disagree'를 Firebase의 'innocent'/'guilty'로 변환
      const firebaseVote: VoteType = selectedVote === 'agree' ? 'innocent' : 'guilty';
      await addComment(id, {
        authorId: user.uid,
        authorNickname: userData.nickname,
        content: newComment,
        vote: firebaseVote,
      });

      // 댓글 다시 로딩
      const commentsData = await getComments(id);
      const commentsWithReplies: CommentWithReplies[] = await Promise.all(
        commentsData.map(async (comment) => {
          const replies = await getReplies(id, comment.id);
          return { ...comment, replies };
        })
      );
      setComments(commentsWithReplies);
      setNewComment('');
    } catch (error) {
      console.error('댓글 추가 실패:', error);
      alert('댓글 추가에 실패했습니다.');
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!id || !user) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (likedComments.has(commentId)) {
      alert('이미 공감한 댓글입니다!');
      return;
    }

    try {
      await addCommentLike(id, commentId);
      
      // 댓글 다시 로딩
      const commentsData = await getComments(id);
      const commentsWithReplies: CommentWithReplies[] = await Promise.all(
        commentsData.map(async (comment) => {
          const replies = await getReplies(id, comment.id);
          return { ...comment, replies };
        })
      );
      setComments(commentsWithReplies);

      // 좋아요한 댓글 저장
      const newLikedComments = new Set(likedComments);
      newLikedComments.add(commentId);
      setLikedComments(newLikedComments);
    } catch (error) {
      console.error('댓글 좋아요 실패:', error);
      alert('댓글 좋아요에 실패했습니다.');
    }
  };

  const handleReplySubmit = async (commentId: string) => {
    if (!id || !user || !userData) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (!replyContent.trim()) {
      alert('답글 내용을 입력해주세요!');
      return;
    }

    try {
      // 선택된 투표가 없으면 댓글의 투표를 사용
      const parentComment = comments.find(c => c.id === commentId);
      const firebaseVote: VoteType = selectedVote === 'agree' 
        ? 'innocent' 
        : selectedVote === 'disagree'
        ? 'guilty'
        : parentComment?.vote || 'innocent';

      await addReply(id, commentId, {
        authorId: user.uid,
        authorNickname: userData.nickname,
        content: replyContent,
        vote: firebaseVote,
      });

      // 댓글 다시 로딩
      const commentsData = await getComments(id);
      const commentsWithReplies: CommentWithReplies[] = await Promise.all(
        commentsData.map(async (comment) => {
          const replies = await getReplies(id, comment.id);
          return { ...comment, replies };
        })
      );
      setComments(commentsWithReplies);
      setReplyContent('');
      setReplyingTo(null);
    } catch (error) {
      console.error('답글 추가 실패:', error);
      alert('답글 추가에 실패했습니다.');
    }
  };

  const handleLikeReply = async (commentId: string, replyId: string) => {
    if (!id || !user) {
      alert('로그인이 필요합니다.');
      return;
    }

    const likeKey = `${commentId}_${replyId}`;
    if (likedComments.has(likeKey)) {
      alert('이미 공감한 답글입니다!');
      return;
    }

    try {
      await addReplyLike(id, commentId, replyId);
      
      // 댓글 다시 로딩
      const commentsData = await getComments(id);
      const commentsWithReplies: CommentWithReplies[] = await Promise.all(
        commentsData.map(async (comment) => {
          const replies = await getReplies(id, comment.id);
          return { ...comment, replies };
        })
      );
      setComments(commentsWithReplies);

      // 좋아요한 답글 저장 (클라이언트 상태만)
      const newLikedComments = new Set(likedComments);
      newLikedComments.add(likeKey);
      setLikedComments(newLikedComments);
    } catch (error) {
      console.error('답글 좋아요 실패:', error);
      alert('답글 좋아요에 실패했습니다.');
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!id || !editContent.trim()) {
      alert('댓글 내용을 입력해주세요!');
      return;
    }

    try {
      await updateComment(id, commentId, editContent);

      // 댓글 다시 로딩
      const commentsData = await getComments(id);
      const commentsWithReplies: CommentWithReplies[] = await Promise.all(
        commentsData.map(async (comment) => {
          const replies = await getReplies(id, comment.id);
          return { ...comment, replies };
        })
      );
      setComments(commentsWithReplies);
      setEditingComment(null);
      setEditContent('');
    } catch (error) {
      console.error('댓글 수정 실패:', error);
      alert('댓글 수정에 실패했습니다.');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!id || !window.confirm('댓글을 삭제하시겠습니까?')) {
      return;
    }

    try {
      await deleteComment(id, commentId);

      // 댓글 다시 로딩
      const commentsData = await getComments(id);
      const commentsWithReplies: CommentWithReplies[] = await Promise.all(
        commentsData.map(async (comment) => {
          const replies = await getReplies(id, comment.id);
          return { ...comment, replies };
        })
      );
      setComments(commentsWithReplies);
    } catch (error) {
      console.error('댓글 삭제 실패:', error);
      alert('댓글 삭제에 실패했습니다.');
    }
  };

  const handleReportComment = () => {
    alert('신고가 접수되었습니다.');
    setShowMenuFor(null);
  };

  const handleEditReply = async (commentId: string, replyId: string) => {
    if (!id || !editReplyContent.trim()) {
      alert('답글 내용을 입력해주세요!');
      return;
    }

    try {
      await updateReply(id, commentId, replyId, editReplyContent);

      // 댓글 다시 로딩
      const commentsData = await getComments(id);
      const commentsWithReplies: CommentWithReplies[] = await Promise.all(
        commentsData.map(async (comment) => {
          const replies = await getReplies(id, comment.id);
          return { ...comment, replies };
        })
      );
      setComments(commentsWithReplies);
      setEditingReply(null);
      setEditReplyContent('');
    } catch (error) {
      console.error('답글 수정 실패:', error);
      alert('답글 수정에 실패했습니다.');
    }
  };

  const handleDeleteReply = async (commentId: string, replyId: string) => {
    if (!id || !window.confirm('답글을 삭제하시겠습니까?')) {
      return;
    }

    try {
      await deleteReply(id, commentId, replyId);

      // 댓글 다시 로딩
      const commentsData = await getComments(id);
      const commentsWithReplies: CommentWithReplies[] = await Promise.all(
        commentsData.map(async (comment) => {
          const replies = await getReplies(id, comment.id);
          return { ...comment, replies };
        })
      );
      setComments(commentsWithReplies);
    } catch (error) {
      console.error('답글 삭제 실패:', error);
      alert('답글 삭제에 실패했습니다.');
    }
  };

  // 댓글 정렬
  const sortedComments = [...comments].sort((a, b) => {
    if (sortBy === 'latest') {
      return b.createdAt.toMillis() - a.createdAt.toMillis();
    } else {
      return (b.likes || 0) - (a.likes || 0);
    }
  });

  // 투표 통계 계산
  const totalVotes = (post?.innocentCount || 0) + (post?.guiltyCount || 0);
  const innocentCount = post?.innocentCount || 0;
  const guiltyCount = post?.guiltyCount || 0;
  const agreePercent = totalVotes > 0 ? Math.round((innocentCount / totalVotes) * 100) : 50;
  const disagreePercent = totalVotes > 0 ? Math.round((guiltyCount / totalVotes) * 100) : 50;

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
                  {user?.uid === post?.authorId ? (
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
              {post.authorNickname} 님
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
              전체 댓글 {comments.length + comments.reduce((sum, comment) => sum + comment.replies.length, 0)}
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
                      backgroundColor: (comment.vote === 'innocent' || comment.vote === 'agree') ? '#E3F2FD' : '#FFEBEE',
                      color: (comment.vote === 'innocent' || comment.vote === 'agree') ? '#1976D2' : '#D32F2F',
                      fontSize: '13px',
                      fontWeight: '600',
                      borderRadius: '6px',
                      height: 'fit-content',
                      whiteSpace: 'nowrap'
                    }}>
                      {(comment.vote === 'innocent' || comment.vote === 'agree') ? '무죄' : '유죄'}
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
                          {comment.authorNickname}
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
                            gap: '10px',
                            position: 'relative'
                          }}
                        >
                          {/* 왼쪽: 답글 아이콘 */}
                          <div style={{
                            height: 'fit-content',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            <img 
                              src={replyArrowIcon} 
                              alt="답글" 
                              style={{ 
                                width: '24px', 
                                height: '24px',
                                objectFit: 'contain'
                              }} 
                            />
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
                                fontSize: '13px',
                                fontWeight: '600'
                              }}>
                                {reply.authorNickname}
                              </span>
                              
                              {/* 우측 버튼들 - 가로 배치 */}
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                                  <span>{reply.likes || 0}</span>
                                </button>
                                {user?.uid === reply.authorId && (
                                  <button
                                    onClick={() => setShowMenuForReply(showMenuForReply === `${comment.id}_${reply.id}` ? null : `${comment.id}_${reply.id}`)}
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
                                )}
                              </div>
                            </div>

                            {/* 답글 내용 또는 수정 폼 */}
                            {editingReply === `${comment.id}_${reply.id}` ? (
                              <div>
                                <textarea
                                  value={editReplyContent}
                                  onChange={(e) => setEditReplyContent(e.target.value)}
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
                                      setEditingReply(null);
                                      setEditReplyContent('');
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
                                    onClick={() => handleEditReply(comment.id, reply.id)}
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
                                fontSize: '13px',
                                margin: '0',
                                lineHeight: '1.4'
                              }}>
                                {reply.content}
                              </p>
                            )}
                          </div>

                          {/* 더보기 메뉴 */}
                          {showMenuForReply === `${comment.id}_${reply.id}` && user?.uid === reply.authorId && (
                            <div style={{
                              position: 'absolute',
                              top: '40px',
                              right: '12px',
                              backgroundColor: 'white',
                              border: '1px solid #ddd',
                              borderRadius: '8px',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                              zIndex: 10,
                              minWidth: '100px'
                            }}>
                              <button
                                onClick={() => {
                                  setEditingReply(`${comment.id}_${reply.id}`);
                                  setEditReplyContent(reply.content);
                                  setShowMenuForReply(null);
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
                                  handleDeleteReply(comment.id, reply.id);
                                  setShowMenuForReply(null);
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
                            </div>
                          )}
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
