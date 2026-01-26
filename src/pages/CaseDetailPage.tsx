import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Asset, Text } from '@toss/tds-mobile';
import { Timestamp } from 'firebase/firestore';
import replyArrowIcon from '../assets/답글화살표-다음에서-변환-png.svg';
import smileIcon from '../assets/smile.png';
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

// 날짜 포맷팅 함수 (M/d HH:mm 형식)
const formatDate = (timestamp: Timestamp): string => {
  const date = timestamp.toDate();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return `${month}/${day} ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

// Comment with replies for UI
interface CommentWithReplies extends CommentDocument {
  replies: ReplyDocument[];
}

function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userData, login, isVerified } = useAuth();
  
  // ❌ 자동 로그인 시도 useEffect 제거됨
  
  // location.state에서 fromTab을 저장 (컴포넌트 마운트 시 한 번만)
  const initialFromTab = (location.state as any)?.fromTab || '재판 중';
  const [fromTab] = useState<string>(initialFromTab);
  
  // fromTab을 sessionStorage에 저장 (토스 앱의 뒤로가기 버튼 대응)
  useEffect(() => {
    if (fromTab) {
      sessionStorage.setItem('caseDetailFromTab', fromTab);
    }
  }, [fromTab]);
  
  // 뒤로가기 처리 함수
  const handleBack = () => {
    navigate('/', { state: { selectedTab: fromTab } });
  };

  // 브라우저/토스 앱의 뒤로가기 버튼 처리
  useEffect(() => {
    const handlePopState = () => {
      const savedFromTab = sessionStorage.getItem('caseDetailFromTab') || fromTab;
      navigate('/', { state: { selectedTab: savedFromTab }, replace: true });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [fromTab, navigate]);

  const [selectedVote, setSelectedVote] = useState<'agree' | 'disagree' | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [newComment, setNewComment] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'likes'>('latest');
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [post, setPost] = useState<CaseDocument | null>(null);

  // 게시물 로딩
  useEffect(() => {
    const loadPost = async () => {
      if (!id) return;
      try {
        const caseData = await getCase(id);
        setPost(caseData || null);
      } catch (error) {
        console.error('게시물 로딩 실패:', error);
        setPost(null);
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
  const [timeRemaining, setTimeRemaining] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);
  const [editingReply, setEditingReply] = useState<string | null>(null);
  const [editReplyContent, setEditReplyContent] = useState('');
  const [showMenuForReply, setShowMenuForReply] = useState<string | null>(null);
  const [showVoteConfirm, setShowVoteConfirm] = useState(false);
  const [pendingVoteType, setPendingVoteType] = useState<'agree' | 'disagree' | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteComplete, setShowDeleteComplete] = useState(false);

  // 투표 가능 시간 계산
  useEffect(() => {
    if (!post || post.status === 'CLOSED') {
      setTimeRemaining(null);
      return;
    }

    const calculateTimeRemaining = () => {
      const endTime = post.voteEndAt!.toMillis();
      const now = Date.now();
      const remaining = endTime - now;

      if (remaining <= 0) {
        setTimeRemaining(null);
        return;
      }

      const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      setTimeRemaining({ days, hours, minutes, seconds });
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);
    return () => clearInterval(interval);
  }, [post]);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showPostMenu && !target.closest('[data-post-menu]') && !target.closest('[data-post-menu-button]')) {
        setShowPostMenu(false);
      }
      if (showMenuFor && !target.closest('[data-comment-menu]') && !target.closest('[data-comment-menu-button]')) {
        setShowMenuFor(null);
      }
      if (showMenuForReply && !target.closest('[data-reply-menu]') && !target.closest('[data-reply-menu-button]')) {
        setShowMenuForReply(null);
      }
    };

    if (showPostMenu || showMenuFor || showMenuForReply) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPostMenu, showMenuFor, showMenuForReply]);

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

  // localStorage에서 좋아요 정보 불러오기
  useEffect(() => {
    // ✅ 검증되지 않은 사용자는 정보를 불러오지 않음 (연결 끊김 대응)
    if (!id || !user || !isVerified) return;
    
    try {
      const storageKey = `liked_comments_${id}_${user.uid}`;
      const savedLikes = localStorage.getItem(storageKey);
      if (savedLikes) {
        const likedArray = JSON.parse(savedLikes);
        setLikedComments(new Set(likedArray));
      }
    } catch (error) {
      console.error('좋아요 정보 불러오기 실패:', error);
    }
  }, [id, user, isVerified]);

  // 투표 여부 확인
  useEffect(() => {
    const loadUserVote = async () => {
      // ✅ 검증되지 않은 사용자는 투표 내역을 불러오지 않음
      if (!id || !user || !isVerified) return;

      try {
        const userVote = await getUserVote(id, user.uid);
        if (userVote) {
          setHasVoted(true);
          setSelectedVote(userVote === 'innocent' ? 'agree' : 'disagree');
        }
      } catch (error) {
        console.error('투표 로딩 실패:', error);
      }
    };
    loadUserVote();
  }, [id, user, isVerified]);

  // 인증 후 돌아왔을 때 사용자 정보가 로드될 때까지 대기 (디버깅용 로그)
  useEffect(() => {
    if (user && userData && isVerified) {
      console.log('✅ 로그인 상태:', userData.nickname);
    } else {
      console.log('❌ 로그인 안 됨 (또는 미검증)');
    }
  }, [user, userData, isVerified]);

  // 핸들러 함수들
  const handleVoteSelect = (voteType: 'agree' | 'disagree') => {
    // 이미 투표했거나 로그인 상태라면 검증
    if (user && isVerified && hasVoted) return;
    
    if (post?.status === 'OPEN') {
      setPendingVoteType(voteType);
      setShowVoteConfirm(true);
    }
  };

  const handleVoteConfirm = async () => {
    if (!pendingVoteType || !id || !post) return;

    if (post.status === 'CLOSED') {
      alert('투표 가능 시간이 종료되었습니다!');
      setShowVoteConfirm(false);
      setPendingVoteType(null);
      return;
    }
    
    // ✅ 로그인 및 검증 확인 (여기서 로그인 유도)
    if (!user || !userData || !isVerified) {
      console.log('로그인 필요, 약관 페이지로 이동');
      setShowVoteConfirm(false);
      setPendingVoteType(null);
      login(); // 토스 로그인 실행
      return;
    }

    if (hasVoted) {
      alert('이미 투표했습니다!');
      setShowVoteConfirm(false);
      setPendingVoteType(null);
      return;
    }
    
    try {
      const firebaseVote: VoteType = pendingVoteType === 'agree' ? 'innocent' : 'guilty';
      await addVote(id, user.uid, firebaseVote);
      
      setSelectedVote(pendingVoteType);
      setHasVoted(true);
      setShowVoteConfirm(false);
      setPendingVoteType(null);
      
      const updatedPost = await getCase(id);
      if (updatedPost) setPost(updatedPost);

      const voteText = pendingVoteType === 'agree' ? '무죄' : '유죄';
      alert(`"${voteText}"로 투표가 완료되었습니다!`);
    } catch (error) {
      console.error('투표 실패:', error);
      alert('투표에 실패했습니다.');
    }
  };

  const handleVoteCancel = () => {
    setShowVoteConfirm(false);
    setPendingVoteType(null);
  };

  const handleCommentSubmit = async () => {
    // ✅ 로그인 및 검증 확인
    if (!id || !user || !userData || !isVerified) {
      alert('로그인이 필요합니다.');
      login();
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
      const firebaseVote: VoteType = selectedVote === 'agree' ? 'innocent' : 'guilty';
      await addComment(id, {
        authorId: user.uid,
        authorNickname: userData.nickname,
        content: newComment,
        vote: firebaseVote,
      });

      const commentsData = await getComments(id);
      const commentsWithReplies = await Promise.all(
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
    // ✅ 로그인 및 검증 확인
    if (!id || !user || !isVerified) {
      alert('로그인이 필요합니다.');
      login();
      return;
    }

    if (!hasVoted) {
      alert('투표 후 공감을 누를 수 있습니다!');
      return;
    }

    if (post?.status === 'CLOSED') return;

    if (likedComments.has(commentId)) {
      alert('이미 공감한 댓글입니다!');
      return;
    }

    try {
      await addCommentLike(id, commentId);
      
      const commentsData = await getComments(id);
      const commentsWithReplies = await Promise.all(
        commentsData.map(async (comment) => {
          const replies = await getReplies(id, comment.id);
          return { ...comment, replies };
        })
      );
      setComments(commentsWithReplies);

      const newLikedComments = new Set(likedComments);
      newLikedComments.add(commentId);
      setLikedComments(newLikedComments);
      
      try {
        const storageKey = `liked_comments_${id}_${user.uid}`;
        localStorage.setItem(storageKey, JSON.stringify(Array.from(newLikedComments)));
      } catch (error) {
        console.error('좋아요 정보 저장 실패:', error);
      }
    } catch (error) {
      console.error('댓글 좋아요 실패:', error);
      alert('댓글 좋아요에 실패했습니다.');
    }
  };

  const handleReplySubmit = async (commentId: string) => {
    // ✅ 로그인 및 검증 확인
    if (!id || !user || !userData || !isVerified) {
      alert('로그인이 필요합니다.');
      login();
      return;
    }

    if (!hasVoted) {
      alert('투표 후 댓글을 작성할 수 있습니다!');
      return;
    }

    if (!replyContent.trim()) {
      alert('답글 내용을 입력해주세요!');
      return;
    }

    try {
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

      const commentsData = await getComments(id);
      const commentsWithReplies = await Promise.all(
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
    // ✅ 로그인 및 검증 확인
    if (!id || !user || !isVerified) {
      alert('로그인이 필요합니다.');
      login();
      return;
    }

    if (!hasVoted) {
      alert('투표 후 공감을 누를 수 있습니다!');
      return;
    }

    if (post?.status === 'CLOSED') return;

    const likeKey = `${commentId}_${replyId}`;
    if (likedComments.has(likeKey)) {
      alert('이미 공감한 답글입니다!');
      return;
    }

    try {
      await addReplyLike(id, commentId, replyId);
      
      const commentsData = await getComments(id);
      const commentsWithReplies = await Promise.all(
        commentsData.map(async (comment) => {
          const replies = await getReplies(id, comment.id);
          return { ...comment, replies };
        })
      );
      setComments(commentsWithReplies);

      const newLikedComments = new Set(likedComments);
      newLikedComments.add(likeKey);
      setLikedComments(newLikedComments);
      
      try {
        const storageKey = `liked_comments_${id}_${user.uid}`;
        localStorage.setItem(storageKey, JSON.stringify(Array.from(newLikedComments)));
      } catch (error) {
        console.error('좋아요 정보 저장 실패:', error);
      }
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
      const commentsData = await getComments(id);
      const commentsWithReplies = await Promise.all(
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
    if (!id || !window.confirm('댓글을 삭제하시겠습니까?')) return;
    try {
      await deleteComment(id, commentId);
      const commentsData = await getComments(id);
      const commentsWithReplies = await Promise.all(
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

  const handleEditReply = async (commentId: string, replyId: string) => {
    if (!id || !editReplyContent.trim()) {
      alert('답글 내용을 입력해주세요!');
      return;
    }
    try {
      await updateReply(id, commentId, replyId, editReplyContent);
      const commentsData = await getComments(id);
      const commentsWithReplies = await Promise.all(
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
    if (!id || !window.confirm('답글을 삭제하시겠습니까?')) return;
    try {
      await deleteReply(id, commentId, replyId);
      const commentsData = await getComments(id);
      const commentsWithReplies = await Promise.all(
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

  const handleDeletePost = () => { setShowDeleteConfirm(true); };
  const handleDeleteCancel = () => { setShowDeleteConfirm(false); };
  const handleEditPost = () => { navigate(`/edit-post/${id}`); };
  const handleGoHome = () => { navigate('/', { state: { selectedTab: fromTab } }); };
  
  const handleDeleteConfirm = async () => {
    setShowDeleteConfirm(false);
    setIsDeleting(true);
    try {
      if (!id) return;
      await deleteCase(id);
      setIsDeleting(false);
      setShowDeleteComplete(true);
    } catch (error) {
      console.error('게시물 삭제 실패:', error);
      setIsDeleting(false);
      alert('게시물 삭제에 실패했습니다.');
    }
  };

  const handleReportComment = () => {
    alert('신고가 접수되었습니다.');
    setShowMenuFor(null);
  };

  const handleReportPost = () => {
    alert('신고가 접수되었습니다.');
    setShowPostMenu(false);
  };

  // 투표 통계 및 정렬
  const totalVotes = (post?.innocentCount || 0) + (post?.guiltyCount || 0);
  const agreePercent = totalVotes > 0 ? Math.round(((post?.innocentCount || 0) / totalVotes) * 100) : 50;
  const disagreePercent = totalVotes > 0 ? Math.round(((post?.guiltyCount || 0) / totalVotes) * 100) : 50;

  // 댓글 정렬
  const sortedComments = [...comments].sort((a, b) => {
    if (sortBy === 'latest') {
      return b.createdAt.toMillis() - a.createdAt.toMillis();
    } else {
      return (b.likes || 0) - (a.likes || 0);
    }
  });

  if (!post) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>게시물을 찾을 수 없습니다.</p>
        <button onClick={handleBack} style={{ marginTop: '20px', padding: '10px 20px' }}>
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#F8F9FA', minHeight: '100vh', paddingBottom: '24px', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ padding: '0 20px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', width: '100%', boxSizing: 'border-box', maxWidth: '100%', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src={smileIcon} alt="smile" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
              <span style={{ color: '#666', fontSize: '13px' }}>{post.authorNickname} 님</span>
            </div>
            {/* 메뉴 버튼은 로그인 + 검증 완료 시에만 노출 */}
            {user && userData && isVerified && (
              <div style={{ position: 'relative' }}>
                <button 
                  data-post-menu-button
                  onClick={() => setShowPostMenu(!showPostMenu)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Asset.Icon frameShape={Asset.frameShape.CleanW20} name="icon-dots-mono" color="rgba(0, 19, 43, 0.58)" aria-label="메뉴" />
                </button>
                {showPostMenu && (
                  <div data-post-menu style={{ position: 'absolute', top: '100%', right: '0', marginTop: '8px', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 1000, minWidth: '120px' }}>
                    {user?.uid === post?.authorId ? (
                      <>
                        <button onClick={() => { handleEditPost(); setShowPostMenu(false); }} style={{ width: '100%', padding: '12px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', color: '#191F28' }}>수정</button>
                        <button onClick={() => { handleDeletePost(); setShowPostMenu(false); }} style={{ width: '100%', padding: '12px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', color: '#D32F2F' }}>삭제</button>
                      </>
                    ) : (
                      <button onClick={handleReportPost} style={{ width: '100%', padding: '12px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', color: '#D32F2F' }}>신고하기</button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <h2 style={{ color: '#191F28', fontSize: '20px', fontWeight: '700', marginBottom: '12px', margin: '0 0 12px 0', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{post.title}</h2>
          <p style={{ color: '#191F28', fontSize: '15px', fontWeight: '400', marginBottom: '20px', lineHeight: '1.6', margin: '0 0 20px 0', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{post.content}</p>

          {post.status === 'OPEN' && (
            <>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <button onClick={() => handleVoteSelect('agree')} disabled={hasVoted} style={{ flex: 1, padding: '12px', backgroundColor: '#E3F2FD', color: '#1976D2', border: selectedVote === 'agree' ? '3px solid #1976D2' : 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: hasVoted ? 'not-allowed' : 'pointer', opacity: hasVoted && selectedVote !== 'agree' ? 0.5 : 1 }}>무죄</button>
                <button onClick={() => handleVoteSelect('disagree')} disabled={hasVoted} style={{ flex: 1, padding: '12px', backgroundColor: '#FFEBEE', color: '#D32F2F', border: selectedVote === 'disagree' ? '3px solid #D32F2F' : 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: hasVoted ? 'not-allowed' : 'pointer', opacity: hasVoted && selectedVote !== 'disagree' ? 0.5 : 1 }}>유죄</button>
              </div>
              {timeRemaining && (
                <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '15px', color: '#191F28', fontWeight: '500' }}>
                  {(() => {
                    const parts: string[] = [];
                    if (timeRemaining.days > 0) parts.push(`${timeRemaining.days}일`);
                    parts.push(`${String(timeRemaining.hours).padStart(2, '0')}시간`);
                    parts.push(`${String(timeRemaining.minutes).padStart(2, '0')}분`);
                    parts.push(`${String(timeRemaining.seconds).padStart(2, '0')}초`);
                    return `${parts.join(' ')} 후 재판 종료`;
                  })()}
                </div>
              )}
            </>
          )}
          {post.status === 'CLOSED' && (
            <button disabled style={{ width: '100%', padding: '16px', backgroundColor: '#F2F4F6', color: '#6B7684', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'not-allowed', marginTop: '12px' }}>재판 완료</button>
          )}
        </div>
      </div>

      {((post.status === 'CLOSED' && totalVotes > 0) || (hasVoted && totalVotes > 0)) && (
        <>
          <div style={{ height: '16px' }} />
          <div style={{ padding: '0 20px', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', width: '100%', boxSizing: 'border-box', maxWidth: '100%', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: '#1976D2', fontSize: '18px', fontWeight: '700' }}>{agreePercent}%</span>
                <span style={{ color: '#666', fontSize: '14px' }}>{post.status === 'CLOSED' ? `${totalVotes}명 재판 완료` : `${totalVotes}명 투표 중`}</span>
                <span style={{ color: '#D32F2F', fontSize: '18px', fontWeight: '700' }}>{disagreePercent}%</span>
              </div>
              <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#f0f0f0' }}>
                <div style={{ width: `${agreePercent}%`, backgroundColor: '#1976D2' }} />
                <div style={{ width: `${disagreePercent}%`, backgroundColor: '#D32F2F' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                <span style={{ color: '#666', fontSize: '13px' }}>무죄</span>
                <span style={{ color: '#666', fontSize: '13px' }}>유죄</span>
              </div>
            </div>
          </div>
        </>
      )}

      <div style={{ height: '16px' }} />

      <div style={{ padding: '0 20px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', width: '100%', boxSizing: 'border-box', maxWidth: '100%', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ color: '#191F28', fontSize: '17px', fontWeight: '600', margin: 0 }}>전체 댓글 {comments.length + comments.reduce((sum, comment) => sum + comment.replies.length, 0)}</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setSortBy('latest')} style={{ padding: '6px 12px', backgroundColor: sortBy === 'latest' ? '#3182F6' : 'transparent', color: sortBy === 'latest' ? 'white' : '#666', border: '1px solid #ddd', borderRadius: '16px', fontSize: '13px', cursor: 'pointer' }}>최신순</button>
              <button onClick={() => setSortBy('likes')} style={{ padding: '6px 12px', backgroundColor: sortBy === 'likes' ? '#3182F6' : 'transparent', color: sortBy === 'likes' ? 'white' : '#666', border: '1px solid #ddd', borderRadius: '16px', fontSize: '13px', cursor: 'pointer' }}>공감순</button>
            </div>
          </div>

          {/* 댓글 작성 폼 (검증 완료된 상태에서만 노출) */}
          {user && userData && isVerified && hasVoted ? (
            <div style={{ marginBottom: '20px' }}>
              <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="의견을 남겨주세요..." style={{ width: '100%', minHeight: '80px', padding: '12px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box', backgroundColor: 'white', color: '#191F28' }} />
              <button onClick={handleCommentSubmit} style={{ marginTop: '8px', padding: '10px 20px', backgroundColor: '#3182F6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', float: 'right' }}>댓글 작성</button>
              <div style={{ clear: 'both' }} />
            </div>
          ) : user && userData && isVerified && !hasVoted && post?.status === 'OPEN' ? (
            <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#FFF4E5', borderRadius: '8px', textAlign: 'center' }}>
              <p style={{ color: '#191F28', fontSize: '14px', margin: 0 }}>💬 투표 후 댓글을 작성할 수 있습니다</p>
            </div>
          ) : null}

          {/* 댓글 목록 렌더링 (이전과 동일) */}
          {sortedComments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {sortedComments.map((comment) => (
                <div key={comment.id}>
                  {/* ... 댓글 내용 ... */}
                  <div style={{ padding: '12px 16px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0', position: 'relative', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ padding: '4px 8px', backgroundColor: comment.vote === 'innocent' ? '#E3F2FD' : '#FFEBEE', color: comment.vote === 'innocent' ? '#1976D2' : '#D32F2F', fontSize: '11px', fontWeight: '600', borderRadius: '4px', height: 'fit-content', whiteSpace: 'nowrap' }}>{comment.vote === 'innocent' ? '무죄' : '유죄'}</div>
                        <Text color="#6B7684" typography="t7" fontWeight="medium">{comment.authorNickname}</Text>
                      </div>
                      
                      {/* 댓글 우측 버튼들 (좋아요, 답글, 더보기) */}
                      <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f2f4f6', borderRadius: '20px', padding: '4px 8px', gap: '0' }}>
                        <button onClick={() => handleLikeComment(comment.id)} disabled={post?.status === 'CLOSED'} style={{ background: 'none', border: 'none', cursor: post?.status === 'CLOSED' ? 'not-allowed' : 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', opacity: post?.status === 'CLOSED' ? 0.5 : 1 }}>
                          <Asset.Icon frameShape={{ width: 12, height: 12 }} backgroundColor="transparent" name="icon-thumb-up-mono" color="#9E9E9E" aria-hidden={true} />
                        </button>
                        <div style={{ width: '1px', height: '16px', backgroundColor: '#9E9E9E', opacity: 0.3 }} />
                        <button onClick={() => { if (post?.status === 'CLOSED') return; if (!hasVoted) { alert('투표 후 댓글을 작성할 수 있습니다!'); return; } setReplyingTo(comment.id); }} disabled={post?.status === 'CLOSED'} style={{ background: 'none', border: 'none', cursor: post?.status === 'CLOSED' ? 'not-allowed' : 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center', opacity: post?.status === 'CLOSED' ? 0.5 : 1 }}>
                          <Asset.Icon frameShape={{ width: 12, height: 12 }} backgroundColor="transparent" name="icon-chat-square-two-mono" color="#9E9E9E" aria-hidden={true} />
                        </button>
                        <div style={{ width: '1px', height: '16px', backgroundColor: '#9E9E9E', opacity: 0.3 }} />
                        <button data-comment-menu-button onClick={() => setShowMenuFor(showMenuFor === comment.id ? null : comment.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
                          <Asset.Icon frameShape={{ width: 12, height: 12 }} backgroundColor="transparent" name="icon-dots-vertical-1-mono" color="#9E9E9E" aria-hidden={true} />
                        </button>
                      </div>
                    </div>

                    {editingComment === comment.id ? (
                      <div>
                        <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} style={{ width: '100%', minHeight: '60px', padding: '8px', border: '1px solid #E5E5E5', borderRadius: '4px', fontSize: '14px', marginBottom: '8px', boxSizing: 'border-box', backgroundColor: 'white', color: '#191F28' }} />
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button onClick={() => { setEditingComment(null); setEditContent(''); }} style={{ padding: '6px 12px', backgroundColor: '#f0f0f0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>취소</button>
                          <button onClick={() => handleEditComment(comment.id)} style={{ padding: '6px 12px', backgroundColor: '#3182F6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>수정</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Text display="block" color="#191F28" typography="t6" fontWeight="regular" style={{ marginBottom: '8px' }}>{comment.content}</Text>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Text display="block" color="#9E9E9E" typography="t7" fontWeight="regular">{formatDate(comment.createdAt)}</Text>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Asset.Icon frameShape={{ width: 15, height: 15 }} backgroundColor="transparent" name="icon-thumb-up-line-mono" color="#D32F2F" aria-hidden={true} />
                            <Text color="#D32F2F" typography="st13" fontWeight="medium">{comment.likes || 0}</Text>
                          </div>
                        </div>
                      </>
                    )}

                    {/* 답글 작성 및 목록 (isVerified 체크 적용) */}
                    {replyingTo === comment.id && post?.status !== 'CLOSED' && (
                      <div style={{ marginTop: '12px' }}>
                        <textarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="답글을 입력하세요..." style={{ width: '100%', minHeight: '60px', padding: '8px', border: '1px solid #E5E5E5', borderRadius: '4px', fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box', backgroundColor: 'white', color: '#191F28' }} />
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button onClick={() => { setReplyingTo(null); setReplyContent(''); }} style={{ padding: '6px 12px', backgroundColor: '#f0f0f0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>취소</button>
                          <button onClick={() => handleReplySubmit(comment.id)} style={{ padding: '6px 12px', backgroundColor: '#3182F6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>답글 작성</button>
                        </div>
                      </div>
                    )}

                    {showMenuFor === comment.id && (
                      <div data-comment-menu style={{ position: 'absolute', top: '50px', right: '16px', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '100px' }}>
                        {user?.uid === comment.authorId ? (
                          <>
                            <button onClick={() => { setEditingComment(comment.id); setEditContent(comment.content); setShowMenuFor(null); }} style={{ width: '100%', padding: '12px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px' }}>수정</button>
                            <button onClick={() => { handleDeleteComment(comment.id); setShowMenuFor(null); }} style={{ width: '100%', padding: '12px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', color: '#D32F2F' }}>삭제</button>
                          </>
                        ) : (
                          <button onClick={handleReportComment} style={{ width: '100%', padding: '12px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', color: '#D32F2F' }}>신고하기</button>
                        )}
                      </div>
                    )}
                  </div>

                  {comment.replies.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      {comment.replies.map((reply) => (
                        <div key={reply.id} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '8px', gap: '8px' }}>
                          <div style={{ marginTop: '10px', height: 'fit-content', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                            <img src={replyArrowIcon} alt="답글" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                          </div>
                          <div style={{ flex: 1, padding: '10px 12px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0', position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ padding: '4px 8px', backgroundColor: reply.vote === 'innocent' ? '#E3F2FD' : '#FFEBEE', color: reply.vote === 'innocent' ? '#1976D2' : '#D32F2F', fontSize: '11px', fontWeight: '600', borderRadius: '4px', height: 'fit-content', whiteSpace: 'nowrap' }}>{reply.vote === 'innocent' ? '무죄' : '유죄'}</div>
                                <Text color="#6B7684" typography="t7" fontWeight="medium">{reply.authorNickname}</Text>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f2f4f6', borderRadius: '20px', padding: '4px 8px', gap: '0' }}>
                                <button onClick={() => handleLikeReply(comment.id, reply.id)} disabled={post?.status === 'CLOSED'} style={{ background: 'none', border: 'none', cursor: post?.status === 'CLOSED' ? 'not-allowed' : 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', opacity: post?.status === 'CLOSED' ? 0.5 : 1 }}>
                                  <Asset.Icon frameShape={{ width: 12, height: 12 }} backgroundColor="transparent" name="icon-thumb-up-mono" color="#9E9E9E" aria-hidden={true} />
                                </button>
                                <div style={{ width: '1px', height: '16px', backgroundColor: '#9E9E9E', opacity: 0.3 }} />
                                <button data-reply-menu-button onClick={() => setShowMenuForReply(showMenuForReply === `${comment.id}_${reply.id}` ? null : `${comment.id}_${reply.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
                                  <Asset.Icon frameShape={{ width: 12, height: 12 }} backgroundColor="transparent" name="icon-dots-vertical-1-mono" color="#9E9E9E" aria-hidden={true} />
                                </button>
                              </div>
                            </div>

                            {editingReply === `${comment.id}_${reply.id}` ? (
                              <div>
                                <textarea value={editReplyContent} onChange={(e) => setEditReplyContent(e.target.value)} style={{ width: '100%', minHeight: '60px', padding: '8px', border: '1px solid #E5E5E5', borderRadius: '4px', fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box', backgroundColor: 'white', color: '#191F28' }} />
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                  <button onClick={() => { setEditingReply(null); setEditReplyContent(''); }} style={{ padding: '6px 12px', backgroundColor: '#f0f0f0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>취소</button>
                                  <button onClick={() => handleEditReply(comment.id, reply.id)} style={{ padding: '6px 12px', backgroundColor: '#3182F6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>수정</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <Text display="block" color="#191F28" typography="t6" fontWeight="regular" style={{ marginBottom: '8px' }}>{reply.content}</Text>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Text display="block" color="#9E9E9E" typography="t7" fontWeight="regular">{formatDate(reply.createdAt)}</Text>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Asset.Icon frameShape={{ width: 15, height: 15 }} backgroundColor="transparent" name="icon-thumb-up-line-mono" color="#D32F2F" aria-hidden={true} />
                                    <Text color="#D32F2F" typography="st13" fontWeight="medium">{reply.likes || 0}</Text>
                                  </div>
                                </div>
                              </>
                            )}

                            {showMenuForReply === `${comment.id}_${reply.id}` && (
                              <div data-reply-menu style={{ position: 'absolute', top: '40px', right: '12px', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '100px' }}>
                                {user?.uid === reply.authorId ? (
                                  <>
                                    <button onClick={() => { setEditingReply(`${comment.id}_${reply.id}`); setEditReplyContent(reply.content); setShowMenuForReply(null); }} style={{ width: '100%', padding: '12px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px' }}>수정</button>
                                    <button onClick={() => { handleDeleteReply(comment.id, reply.id); setShowMenuForReply(null); }} style={{ width: '100%', padding: '12px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', color: '#D32F2F' }}>삭제</button>
                                  </>
                                ) : (
                                  <button onClick={() => { handleReportComment(); setShowMenuForReply(null); }} style={{ width: '100%', padding: '12px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', color: '#D32F2F' }}>신고하기</button>
                                )}
                              </div>
                            )}
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

      {showVoteConfirm && pendingVoteType && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={handleVoteCancel}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '400px', boxSizing: 'border-box' }} onClick={(e) => e.stopPropagation()}>
            <Text display="block" color="#191F28ff" typography="t4" fontWeight="bold" textAlign="center" style={{ marginBottom: '12px' }}>'{pendingVoteType === 'agree' ? '무죄' : '유죄'}'로 하시겠어요?</Text>
            <Text display="block" color="#191F28" typography="t7" fontWeight="regular" textAlign="center" style={{ marginBottom: '24px' }}>한 번 재판 완료하면 수정할 수 없어요!</Text>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleVoteCancel} style={{ flex: 1, padding: '12px', backgroundColor: '#f0f0f0', color: '#191F28', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>닫기</button>
              <button onClick={handleVoteConfirm} style={{ flex: 1, padding: '12px', backgroundColor: '#3182F6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>완료</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={handleDeleteCancel}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '400px', boxSizing: 'border-box' }} onClick={(e) => e.stopPropagation()}>
            <Text display="block" color="#191F28ff" typography="t4" fontWeight="bold" textAlign="center" style={{ marginBottom: '12px' }}>정말 삭제하시겠어요?</Text>
            <Text display="block" color="#191F28" typography="t7" fontWeight="regular" textAlign="center" style={{ marginBottom: '24px' }}>한 번 삭제하면 복원은 어려워요!</Text>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleDeleteCancel} style={{ flex: 1, padding: '12px', backgroundColor: '#f0f0f0', color: '#191F28', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>취소</button>
              <button onClick={handleDeleteConfirm} style={{ flex: 1, padding: '12px', backgroundColor: '#3182F6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {isDeleting && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
          <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #3182F6', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
          <div style={{ color: '#191F28', fontSize: '16px', fontWeight: '500' }}>게시글을 삭제하고 있어요</div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {showDeleteComplete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
          <svg width="100" height="100" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: '24px' }}>
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="#3182F6" />
          </svg>
          <div style={{ color: '#666', fontSize: '20px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center' }}>삭제 완료했어요!</div>
          <button onClick={handleGoHome} style={{ padding: '12px 24px', backgroundColor: '#3182F6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', minWidth: '120px' }}>홈으로</button>
        </div>
      )}
    </div>
  );
}

export default CaseDetailPage;