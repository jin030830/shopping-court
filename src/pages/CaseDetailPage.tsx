import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Asset, Text } from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { Timestamp } from 'firebase/firestore';
import replyArrowIcon from '../assets/arrow.svg';
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTodayDateString, type UserDocument } from '../api/user';

// 날짜 포맷팅 함수 (M/d HH:mm 형식)
const formatDate = (timestamp: Timestamp): string => {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return `${month}/${day} ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

// UI용 댓글 타입 (대댓글 포함)
interface CommentWithReplies extends CommentDocument {
  replies: ReplyDocument[];
}

function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, userData, login, isVerified } = useAuth();
  
  const initialFromTab = (location.state as { fromTab?: string })?.fromTab || '재판 중';
  const [fromTab] = useState<string>(initialFromTab);
  
  useEffect(() => {
    if (fromTab) {
      sessionStorage.setItem('caseDetailFromTab', fromTab);
    }
  }, [fromTab]);
  
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      if (fromTab === '내가 쓴 글') {
        const myPostsFromTab = sessionStorage.getItem('myPostsFromTab') || 'HOT 게시판';
        navigate('/my-posts', { state: { fromTab: myPostsFromTab }, replace: true });
      } else {
        navigate('/', { state: { selectedTab: fromTab }, replace: true });
      }
    }
  };

  // [Query] 게시물 상세 정보
  const { data: post, isInitialLoading: isLoadingPost } = useQuery<CaseDocument | null, Error>({
    queryKey: ['case', id],
    queryFn: () => (id ? getCase(id) : Promise.resolve(null)),
    enabled: !!id,
    staleTime: 1000 * 60, // 1분간 캐시 유지 (뒤로가기 시 즉시 로딩 방지)
  });

  // [Query] 댓글 및 대댓글 통합 정보
  const { data: comments = [] } = useQuery<CommentWithReplies[], Error>({
    queryKey: ['case', id, 'comments'],
    queryFn: async () => {
      if (!id) return [];
      const commentsData = await getComments(id);
      return await Promise.all(
        commentsData.map(async (comment) => {
          const replies = await getReplies(id, comment.id);
          return { ...comment, replies };
        })
      );
    },
    enabled: !!id,
    staleTime: 1000 * 30, // 30초간 캐시 유지
  });

  // [Query] 현재 사용자의 투표 상태 확인
  const { data: userVoteData } = useQuery<VoteType | null, Error>({
    queryKey: ['case', id, 'vote', user?.uid],
    queryFn: () => (id && user && isVerified ? getUserVote(id, user.uid) : Promise.resolve(null)),
    enabled: !!id && !!user && isVerified,
    staleTime: 1000 * 60 * 60, // 투표 상태는 변경되지 않으므로 길게 유지
  });

  const hasVoted = !!userVoteData;
  const selectedVote = userVoteData === 'innocent' ? 'agree' : userVoteData === 'guilty' ? 'disagree' : null;

  // UI States
  const [newComment, setNewComment] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'likes'>('latest');
  const [likedComments, setLikedComments] = useState<Set<string>>(() => {
    if (!id || !user || !isVerified) return new Set();
    try {
      const storageKey = `liked_comments_${id}_${user.uid}`;
      const savedLikes = localStorage.getItem(storageKey);
      return savedLikes ? new Set(JSON.parse(savedLikes)) : new Set();
    } catch (e) {
      console.error(e);
      return new Set();
    }
  });
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showMenuFor, setShowMenuFor] = useState<string | null>(null);
  const [showPostMenu, setShowPostMenu] = useState(false);
  
  // 타이머용 현재 시간 상태
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // 남은 시간 계산 (렌더링 시 유도하여 useEffect 내 setState 회피)
  const timeRemaining = useMemo(() => {
    if (!post || post.status === 'CLOSED' || !post.voteEndAt) return null;
    const endTime = post.voteEndAt.toMillis();
    const remaining = endTime - now;
    if (remaining <= 0) return null;
    return {
      days: Math.floor(remaining / (1000 * 60 * 60 * 24)),
      hours: Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((remaining % (1000 * 60)) / 1000)
    };
  }, [post, now]);

  const [editingReply, setEditingReply] = useState<string | null>(null);
  const [editReplyContent, setEditReplyContent] = useState('');
  const [showMenuForReply, setShowMenuForReply] = useState<string | null>(null);
  const [showVoteConfirm, setShowVoteConfirm] = useState(false);
  const [pendingVoteType, setPendingVoteType] = useState<'agree' | 'disagree' | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteComplete, setShowDeleteComplete] = useState(false);

  // [Mutation] 투표하기 (낙관적 업데이트 적용)
  const addVoteMutation = useMutation({
    mutationFn: ({ voteType }: { voteType: VoteType }) => addVote(id!, user!.uid, voteType),
    onMutate: async ({ voteType }) => {
      await queryClient.cancelQueries({ queryKey: ['case', id] });
      await queryClient.cancelQueries({ queryKey: ['case', id, 'vote', user?.uid] });
      if (user) {
        await queryClient.cancelQueries({ queryKey: ['user', user.uid] });
      }
      
      const previousPost = queryClient.getQueryData<CaseDocument>(['case', id]);
      const previousVote = queryClient.getQueryData<VoteType>(['case', id, 'vote', user?.uid]);
      const previousUserData = user ? queryClient.getQueryData<UserDocument | null>(['user', user.uid]) : null;

      // 게시물 투표 수 낙관적 업데이트
      queryClient.setQueryData(['case', id], (old: CaseDocument | undefined) => {
        if (!old) return old;
        return {
          ...old,
          guiltyCount: voteType === 'guilty' ? (old.guiltyCount || 0) + 1 : (old.guiltyCount || 0),
          innocentCount: voteType === 'innocent' ? (old.innocentCount || 0) + 1 : (old.innocentCount || 0),
        };
      });
      queryClient.setQueryData(['case', id, 'vote', user?.uid], voteType);

      // userData의 voteCount 낙관적 업데이트
      if (user) {
        const today = getTodayDateString();
        queryClient.setQueryData<UserDocument | null>(['user', user.uid], (prev) => {
          if (!prev) return prev;
          
          const rawDailyStats = prev.dailyStats || { 
            voteCount: 0, 
            commentCount: 0, 
            postCount: 0, 
            lastActiveDate: today, 
            isLevel1Claimed: false, 
            isLevel2Claimed: false 
          };
          
          const isDateMismatched = rawDailyStats.lastActiveDate !== today;
          const currentVoteCount = isDateMismatched ? 0 : (rawDailyStats.voteCount || 0);
          
          return {
            ...prev,
            dailyStats: {
              ...rawDailyStats,
              voteCount: currentVoteCount + 1,
              lastActiveDate: today
            }
          };
        });
      }

      return { previousPost, previousVote, previousUserData };
    },
    onError: (_err, _variables, context) => {
      queryClient.setQueryData(['case', id], context?.previousPost);
      queryClient.setQueryData(['case', id, 'vote', user?.uid], context?.previousVote);
      if (user && context?.previousUserData) {
        queryClient.setQueryData(['user', user.uid], context.previousUserData);
      }
      alert('투표에 실패했습니다.');
    },
    onSuccess: () => {
      // 성공 후 약간의 지연을 두고 서버 데이터와 동기화 (트리거 지연 고려)
      // 게시물 데이터는 낙관적 업데이트가 이미 적용되어 있으므로 즉시 invalidate하지 않음
      // 대신 더 긴 지연 후 동기화하여 서버 업데이트 완료 후 동기화
      queryClient.invalidateQueries({ queryKey: ['case', id, 'vote', user?.uid] });
      if (user) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['user', user.uid] });
        }, 1000);
      }
      // 게시물 데이터는 3초 후 동기화 (트리거 완료 대기) - 낙관적 업데이트 유지
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['case', id] });
      }, 3000);
    }
  });

  // [Mutation] 댓글 작성 (낙관적 업데이트 적용)
  const addCommentMutation = useMutation({
    mutationFn: (commentData: { authorId: string; authorNickname: string; content: string; vote: VoteType }) => addComment(id!, commentData),
    onMutate: async (newCommentData) => {
      await queryClient.cancelQueries({ queryKey: ['case', id, 'comments'] });
      if (user) {
        await queryClient.cancelQueries({ queryKey: ['user', user.uid] });
      }
      
      const previousComments = queryClient.getQueryData<CommentWithReplies[]>(['case', id, 'comments']);
      const previousUserData = user ? queryClient.getQueryData<UserDocument | null>(['user', user.uid]) : null;
      
      const optimisticComment: CommentWithReplies = {
        id: 'temp-' + Date.now(),
        ...newCommentData,
        createdAt: Timestamp.now(),
        likes: 0,
        likedBy: [],
        replies: []
      };

      queryClient.setQueryData(['case', id, 'comments'], (old: CommentWithReplies[] | undefined) => [optimisticComment, ...(old || [])]);
      
      // userData의 commentCount 낙관적 업데이트
      if (user) {
        const today = getTodayDateString();
        queryClient.setQueryData<UserDocument | null>(['user', user.uid], (prev) => {
          if (!prev) return prev;
          
          const rawDailyStats = prev.dailyStats || { 
            voteCount: 0, 
            commentCount: 0, 
            postCount: 0, 
            lastActiveDate: today, 
            isLevel1Claimed: false, 
            isLevel2Claimed: false 
          };
          
          const isDateMismatched = rawDailyStats.lastActiveDate !== today;
          const currentCommentCount = isDateMismatched ? 0 : (rawDailyStats.commentCount || 0);
          
          return {
            ...prev,
            dailyStats: {
              ...rawDailyStats,
              commentCount: currentCommentCount + 1,
              lastActiveDate: today
            }
          };
        });
      }

      return { previousComments, previousUserData };
    },
    onError: (_err, _newCommentData, context) => {
      queryClient.setQueryData(['case', id, 'comments'], context?.previousComments);
      if (user && context?.previousUserData) {
        queryClient.setQueryData(['user', user.uid], context.previousUserData);
      }
      alert('댓글 추가에 실패했습니다.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['case', id, 'comments'] });
      // Cloud Functions 트리거 지연을 고려하여 1초 후 동기화
      if (user) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['user', user.uid] });
        }, 1000);
      }
    }
  });

  // [Mutation] 대댓글 작성 (낙관적 업데이트 적용)
  const addReplyMutation = useMutation({
    mutationFn: ({ commentId, replyData }: { commentId: string; replyData: { authorId: string; authorNickname: string; content: string; vote: VoteType } }) => 
      addReply(id!, commentId, replyData),
    onMutate: async ({ commentId, replyData }) => {
      await queryClient.cancelQueries({ queryKey: ['case', id, 'comments'] });
      if (user) {
        await queryClient.cancelQueries({ queryKey: ['user', user.uid] });
      }
      
      const previousComments = queryClient.getQueryData<CommentWithReplies[]>(['case', id, 'comments']);
      const previousUserData = user ? queryClient.getQueryData<UserDocument | null>(['user', user.uid]) : null;
      
      const optimisticReply: ReplyDocument = {
        id: 'temp-reply-' + Date.now(),
        ...replyData,
        createdAt: Timestamp.now(),
        likes: 0,
        likedBy: []
      };

      // 해당 댓글의 replies 배열에 낙관적 대댓글 추가
      queryClient.setQueryData(['case', id, 'comments'], (old: CommentWithReplies[] | undefined) => {
        if (!old) return old;
        return old.map(comment => 
          comment.id === commentId
            ? { ...comment, replies: [...(comment.replies || []), optimisticReply] }
            : comment
        );
      });
      
      // userData의 commentCount 낙관적 업데이트
      if (user) {
        const today = getTodayDateString();
        queryClient.setQueryData<UserDocument | null>(['user', user.uid], (prev) => {
          if (!prev) return prev;
          
          const rawDailyStats = prev.dailyStats || { 
            voteCount: 0, 
            commentCount: 0, 
            postCount: 0, 
            lastActiveDate: today, 
            isLevel1Claimed: false, 
            isLevel2Claimed: false 
          };
          
          const isDateMismatched = rawDailyStats.lastActiveDate !== today;
          const currentCommentCount = isDateMismatched ? 0 : (rawDailyStats.commentCount || 0);
          
          return {
            ...prev,
            dailyStats: {
              ...rawDailyStats,
              commentCount: currentCommentCount + 1,
              lastActiveDate: today
            }
          };
        });
      }

      return { previousComments, previousUserData };
    },
    onError: (_err, _variables, context) => {
      queryClient.setQueryData(['case', id, 'comments'], context?.previousComments);
      if (user && context?.previousUserData) {
        queryClient.setQueryData(['user', user.uid], context.previousUserData);
      }
      alert('답글 추가에 실패했습니다.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['case', id, 'comments'] });
      // Cloud Functions 트리거 지연을 고려하여 1초 후 동기화
      if (user) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['user', user.uid] });
        }, 1000);
      }
    }
  });

  // [Mutation] 게시물 삭제
  const deletePostMutation = useMutation({
    mutationFn: () => deleteCase(id!),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['case', id] });
      setShowDeleteComplete(true);
    },
    onError: () => {
      alert('게시물 삭제에 실패했습니다.');
    }
  });

  // 외부 클릭 감지 (메뉴 닫기)
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

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPostMenu, showMenuFor, showMenuForReply]);

  // --- 비즈니스 로직 핸들러 ---

  const handleVoteSelect = useCallback((voteType: 'agree' | 'disagree') => {
    if (user && isVerified && hasVoted) return;
    if (post?.status === 'OPEN') {
      setPendingVoteType(voteType);
      setShowVoteConfirm(true);
    }
  }, [user, isVerified, hasVoted, post?.status]);

  const handleVoteConfirm = () => {
    if (!pendingVoteType || !id || !post || addVoteMutation.isPending) return;
    if (!user || !userData || !isVerified) { login(); return; }

    const firebaseVote: VoteType = pendingVoteType === 'agree' ? 'innocent' : 'guilty';
    addVoteMutation.mutate({ voteType: firebaseVote });
    setShowVoteConfirm(false);
    setPendingVoteType(null);
  };

  const handleCommentSubmit = () => {
    if (addCommentMutation.isPending || !id || !user || !userData || !isVerified || !hasVoted || !newComment.trim()) return;

    const firebaseVote: VoteType = selectedVote === 'agree' ? 'innocent' : 'guilty';
    addCommentMutation.mutate({
      authorId: user.uid,
      authorNickname: userData.nickname,
      content: newComment,
      vote: firebaseVote,
    });
    setNewComment('');
  };

  const handleLikeComment = async (commentId: string) => {
    if (!id || !user || !isVerified || !hasVoted || post?.status === 'CLOSED' || likedComments.has(commentId)) return;

    try {
      await addCommentLike(id, commentId);
      queryClient.invalidateQueries({ queryKey: ['case', id, 'comments'] });
      const newLikedComments = new Set(likedComments);
      newLikedComments.add(commentId);
      setLikedComments(newLikedComments);
      localStorage.setItem(`liked_comments_${id}_${user.uid}`, JSON.stringify(Array.from(newLikedComments)));
    } catch (e) { console.error(e); }
  };

  const handleReplySubmit = async (commentId: string) => {
    if (!id || !user || !userData || !isVerified || !hasVoted || !replyContent.trim() || addReplyMutation.isPending) return;

    const parentComment = comments.find(c => c.id === commentId);
    const firebaseVote: VoteType = selectedVote === 'agree' ? 'innocent' : selectedVote === 'disagree' ? 'guilty' : parentComment?.vote || 'innocent';

    addReplyMutation.mutate({
      commentId,
      replyData: {
        authorId: user.uid,
        authorNickname: userData.nickname,
        content: replyContent,
        vote: firebaseVote,
      }
    });
    
    setReplyContent('');
    setReplyingTo(null);
  };

  const handleLikeReply = async (commentId: string, replyId: string) => {
    if (!id || !user || !isVerified || !hasVoted || post?.status === 'CLOSED') return;
    const likeKey = `${commentId}_${replyId}`;
    if (likedComments.has(likeKey)) return;

    try {
      await addReplyLike(id, commentId, replyId);
      queryClient.invalidateQueries({ queryKey: ['case', id, 'comments'] });
      const newLikedComments = new Set(likedComments);
      newLikedComments.add(likeKey);
      setLikedComments(newLikedComments);
      localStorage.setItem(`liked_comments_${id}_${user.uid}`, JSON.stringify(Array.from(newLikedComments)));
    } catch (e) { console.error(e); }
  };

  const handleEditComment = async (commentId: string) => {
    if (!id || !editContent.trim()) return;
    try {
      await updateComment(id, commentId, editContent);
      setEditingComment(null);
      setEditContent('');
      queryClient.invalidateQueries({ queryKey: ['case', id, 'comments'] });
    } catch (e) { console.error(e); }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!id || !window.confirm('댓글을 삭제하시겠습니까?')) return;
    try {
      await deleteComment(id, commentId);
      queryClient.invalidateQueries({ queryKey: ['case', id, 'comments'] });
    } catch (e) { console.error(e); }
  };

  const handleEditReply = async (commentId: string, replyId: string) => {
    if (!id || !editReplyContent.trim()) return;
    try {
      await updateReply(id, commentId, replyId, editReplyContent);
      setEditingReply(null);
      setEditReplyContent('');
      queryClient.invalidateQueries({ queryKey: ['case', id, 'comments'] });
    } catch (e) { console.error(e); }
  };

  const handleDeleteReply = async (commentId: string, replyId: string) => {
    if (!id || !window.confirm('답글을 삭제하시겠습니까?')) return;
    try {
      await deleteReply(id, commentId, replyId);
      queryClient.invalidateQueries({ queryKey: ['case', id, 'comments'] });
    } catch (e) { console.error(e); }
  };

  const handleDeletePostConfirm = () => {
    setShowDeleteConfirm(false);
    deletePostMutation.mutate();
  };

  // --- 데이터 가공 ---

  const totalVotes = (post?.innocentCount || 0) + (post?.guiltyCount || 0);
  const agreePercent = totalVotes > 0 ? Math.round(((post?.innocentCount || 0) / totalVotes) * 100) : 50;
  const disagreePercent = totalVotes > 0 ? Math.round(((post?.guiltyCount || 0) / totalVotes) * 100) : 50;

  const sortedComments = useMemo(() => {
    return [...comments].sort((a, b) => {
      if (sortBy === 'latest') {
        return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
      } else {
        return (b.likes || 0) - (a.likes || 0);
      }
    });
  }, [comments, sortBy]);

  // --- 렌더링 영역 ---

  if (isLoadingPost) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#F8F9FA', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #3182F6', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
        <Text color="#6B7684">게시물을 불러오고 있습니다...</Text>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!post) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#F8F9FA', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Text display="block" typography="t5" fontWeight="bold" color="#191F28" style={{ marginBottom: '12px' }}>게시물을 찾을 수 없습니다.</Text>
        <button onClick={handleBack} style={{ padding: '12px 24px', backgroundColor: '#3182F6', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>홈으로 돌아가기</button>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#F8F9FA', minHeight: '100vh', paddingBottom: '24px', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ height: '12px', backgroundColor: '#F8F9FA' }} />

      {/* 게시물 카드 */}
      <div style={{ padding: '0 13px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ backgroundColor: 'white', padding: '2px 13px 16px 13px', borderRadius: '12px', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0px', marginLeft: '-8px', marginTop: '4px' }}>
              <img src={smileIcon} alt="avatar" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
              <span style={{ color: '#666', fontSize: '13px' }}>피고인 {post.authorNickname.replace(/^배심원/, '')}님</span>
            </div>
            {user && userData && isVerified && (
              <div style={{ position: 'relative' }}>
                <button data-post-menu-button onClick={() => setShowPostMenu(!showPostMenu)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                  <Asset.Icon frameShape={Asset.frameShape.CleanW20} name="icon-dots-mono" color="rgba(0, 19, 43, 0.58)" />
                </button>
                {showPostMenu && (
                  <div data-post-menu style={{ position: 'absolute', top: '100%', right: '0', marginTop: '8px', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 1000, minWidth: '120px' }}>
                    {user?.uid === post?.authorId ? (
                      <>
                        {post?.status === 'OPEN' && (
                          <button onClick={() => { navigate(`/edit-post/${id}`); setShowPostMenu(false); }} style={{ width: '100%', padding: '12px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', color: '#191F28' }}>수정</button>
                        )}
                        <button onClick={() => { setShowDeleteConfirm(true); setShowPostMenu(false); }} style={{ width: '100%', padding: '12px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', color: '#D32F2F' }}>삭제</button>
                      </>
                    ) : (
                      <button onClick={() => alert('신고가 접수되었습니다.')} style={{ width: '100%', padding: '12px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', color: '#D32F2F' }}>신고하기</button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <h2 style={{ color: '#191F28', fontSize: '20px', fontWeight: '700', marginBottom: '6px', textAlign: 'center' }}>{post.title}</h2>
          <p style={{ color: '#191F28', fontSize: '15px', fontWeight: '400', marginBottom: '20px', lineHeight: '1.6' }}>{post.content}</p>

          {post.status === 'OPEN' && (
            <div style={{ display: 'flex', gap: '12px', marginBottom: '26px', position: 'relative' }}>
              <button onClick={() => handleVoteSelect('agree')} disabled={hasVoted} style={{ flex: 1, padding: '12px', backgroundColor: '#E3F2FD', color: '#1976D2', border: selectedVote === 'agree' ? '3px solid #1976D2' : 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: hasVoted ? 'not-allowed' : 'pointer', opacity: hasVoted && selectedVote !== 'agree' ? 0.5 : 1 }}>무죄</button>
              <button onClick={() => handleVoteSelect('disagree')} disabled={hasVoted} style={{ flex: 1, padding: '12px', backgroundColor: '#FFEBEE', color: '#D32F2F', border: selectedVote === 'disagree' ? '3px solid #D32F2F' : 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: hasVoted ? 'not-allowed' : 'pointer', opacity: hasVoted && selectedVote !== 'disagree' ? 0.5 : 1 }}>유죄</button>
              {timeRemaining && (
                <div style={{ position: 'absolute', bottom: '-25px', right: '0', fontSize: '13px', color: '#9E9E9E' }}>
                  남은 재판 시간 {timeRemaining.days > 0 ? `${timeRemaining.days}일 ` : ''}{String(timeRemaining.hours).padStart(2, '0')} : {String(timeRemaining.minutes).padStart(2, '0')} : {String(timeRemaining.seconds).padStart(2, '0')}
                </div>
              )}
            </div>
          )}
          {post.status === 'CLOSED' && (
            <button disabled style={{ width: '100%', padding: '16px', backgroundColor: '#F2F4F6', color: '#6B7684', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '600', marginTop: '8px' }}>재판 완료</button>
          )}
        </div>
      </div>

      {/* 투표 결과 현황 */}
      {(post.status === 'CLOSED' || hasVoted) && totalVotes > 0 && (
        <div style={{ padding: '12px 13px 0 13px', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: 'white', padding: '20px 15px', borderRadius: '12px', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ color: '#1976D2', fontSize: '18px', fontWeight: '700' }}>{agreePercent}%</span>
              <span style={{ color: '#666', fontSize: '14px' }}>{post.status === 'CLOSED' ? `${totalVotes}명 재판 완료` : `${totalVotes}명 투표 중`}</span>
              <span style={{ color: '#D32F2F', fontSize: '18px', fontWeight: '700' }}>{disagreePercent}%</span>
            </div>
            <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#f0f0f0' }}>
              <div style={{ width: `${agreePercent}%`, backgroundColor: '#1976D2' }} />
              <div style={{ width: `${disagreePercent}%`, backgroundColor: '#D32F2F' }} />
            </div>
          </div>
        </div>
      )}

      <div style={{ height: '12px' }} />

      {/* 댓글 영역 */}
      <div style={{ padding: '0 13px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ backgroundColor: 'white', padding: '20px 13px', borderRadius: '12px', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ color: '#191F28', fontSize: '17px', fontWeight: '600', margin: 0 }}>전체 댓글 {comments.length + comments.reduce((sum, comment) => sum + comment.replies.length, 0)}</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setSortBy('latest')} style={{ padding: '6px 12px', backgroundColor: sortBy === 'latest' ? '#3182F6' : 'transparent', color: sortBy === 'latest' ? 'white' : '#666', border: '1px solid #ddd', borderRadius: '16px', fontSize: '13px', cursor: 'pointer' }}>최신순</button>
              <button onClick={() => setSortBy('likes')} style={{ padding: '6px 12px', backgroundColor: sortBy === 'likes' ? '#3182F6' : 'transparent', color: sortBy === 'likes' ? 'white' : '#666', border: '1px solid #ddd', borderRadius: '16px', fontSize: '13px', cursor: 'pointer' }}>공감순</button>
            </div>
          </div>

          {/* 댓글 입력란 */}
          {user && userData && isVerified && hasVoted && post?.status === 'OPEN' ? (
            <div style={{ marginBottom: '20px' }}>
              <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="의견을 남겨주세요..." style={{ width: '100%', minHeight: '80px', padding: '12px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box', backgroundColor: 'white', color: '#191F28' }} />
              <button onClick={handleCommentSubmit} disabled={addCommentMutation.isPending} style={{ marginTop: '8px', padding: '10px 20px', backgroundColor: '#3182F6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', float: 'right' }}>댓글 작성</button>
              <div style={{ clear: 'both' }} />
            </div>
          ) : user && userData && isVerified && !hasVoted && post?.status === 'OPEN' ? (
            <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#F7F3EE', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Asset.Image frameShape={{ width: 22, height: 22 }} backgroundColor="transparent" src="https://static.toss.im/icons/svg/svg/png/4x/icon-chat-bubble-dots-grey300.png" style={{ aspectRatio: '1/1' }} />
              <Text color={adaptive.grey700} typography="t6" fontWeight="regular">투표 후 댓글을 작성할 수 있어요</Text>
            </div>
          ) : null}

          {/* 댓글 리스트 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sortedComments.map((comment) => (
              <div key={comment.id}>
                <div style={{ padding: '12px 16px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0', position: 'relative', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ padding: '3px 6px', backgroundColor: comment.authorId === post?.authorId ? '#FFB33128' : (comment.vote === 'innocent' ? '#E3F2FD' : '#FFEBEE'), color: comment.authorId === post?.authorId ? '#B45309' : (comment.vote === 'innocent' ? '#1976D2' : '#D32F2F'), fontSize: '11px', fontWeight: '600', borderRadius: '4px', height: 'fit-content', whiteSpace: 'nowrap' }}>{comment.authorId === post?.authorId ? '작성자' : (comment.vote === 'innocent' ? '무죄' : '유죄')}</div>
                      <Text color="#6B7684" typography="t7" fontWeight="medium" style={{ fontSize: '13px' }}>{comment.authorNickname.replace(/^배심원/, '')}님</Text>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f2f4f6', borderRadius: '20px', padding: '4px 8px' }}>
                      <button onClick={() => handleLikeComment(comment.id)} disabled={post?.status === 'CLOSED'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
                        <Asset.Icon frameShape={{ width: 14, height: 14 }} backgroundColor="transparent" name="icon-thumb-up-mono" color="#9E9E9E" />
                      </button>
                      <div style={{ width: '1px', height: '16px', backgroundColor: '#9E9E9E', opacity: 0.3 }} />
                      <button onClick={() => { if (post?.status === 'CLOSED') return; if (!hasVoted) { alert('투표 후 댓글을 작성할 수 있습니다!'); return; } setReplyingTo(comment.id); }} disabled={post?.status === 'CLOSED'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
                        <Asset.Icon frameShape={{ width: 14, height: 14 }} backgroundColor="transparent" name="icon-chat-square-two-mono" color="#9E9E9E" />
                      </button>
                      <div style={{ width: '1px', height: '16px', backgroundColor: '#9E9E9E', opacity: 0.3 }} />
                      <button data-comment-menu-button onClick={() => setShowMenuFor(showMenuFor === comment.id ? null : comment.id)} style={{ background: 'none', border: 'none', padding: '4px 8px' }}>
                        <Asset.Icon frameShape={{ width: 14, height: 14 }} backgroundColor="transparent" name="icon-dots-vertical-1-mono" color="#9E9E9E" />
                      </button>
                    </div>
                  </div>

                  {editingComment === comment.id ? (
                    <div>
                      <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} style={{ width: '100%', minHeight: '60px', padding: '8px', border: '1px solid #E5E5E5', borderRadius: '4px', fontSize: '14px', marginBottom: '8px', boxSizing: 'border-box' }} />
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditingComment(null)} style={{ padding: '6px 12px', backgroundColor: '#f0f0f0', border: 'none', borderRadius: '4px', fontSize: '13px' }}>취소</button>
                        <button onClick={() => handleEditComment(comment.id)} style={{ padding: '6px 12px', backgroundColor: '#3182F6', color: 'white', border: 'none', borderRadius: '4px', fontSize: '13px' }}>수정</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Text display="block" color="#191F28" typography="t6" fontWeight="regular" style={{ marginBottom: '4px' }}>{comment.content}</Text>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Text display="block" color="#9E9E9E" typography="t7" fontWeight="regular" style={{ fontSize: '13px' }}>{formatDate(comment.createdAt)}</Text>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Asset.Icon frameShape={{ width: 15, height: 15 }} name="icon-thumb-up-line-mono" color="#D32F2F" />
                          <Text color="#D32F2F" typography="st13" fontWeight="medium" style={{ fontSize: '13px' }}>{comment.likes || 0}</Text>
                        </div>
                      </div>
                    </>
                  )}

                  {/* 답글 입력란 */}
                  {replyingTo === comment.id && post?.status !== 'CLOSED' && (
                    <div style={{ marginTop: '12px' }}>
                      <textarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="답글을 입력하세요..." style={{ width: '100%', minHeight: '60px', padding: '8px', border: '1px solid #E5E5E5', borderRadius: '4px', fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box' }} />
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setReplyingTo(null)} style={{ padding: '6px 12px', backgroundColor: '#f0f0f0', border: 'none', borderRadius: '4px', fontSize: '13px' }}>취소</button>
                        <button onClick={() => handleReplySubmit(comment.id)} disabled={addReplyMutation.isPending} style={{ padding: '6px 12px', backgroundColor: '#3182F6', color: 'white', border: 'none', borderRadius: '4px', fontSize: '13px', cursor: addReplyMutation.isPending ? 'not-allowed' : 'pointer', opacity: addReplyMutation.isPending ? 0.6 : 1 }}>답글 작성</button>
                      </div>
                    </div>
                  )}

                  {/* 댓글 메뉴 */}
                  {showMenuFor === comment.id && (
                    <div data-comment-menu style={{ position: 'absolute', top: '50px', right: '16px', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '100px' }}>
                      {user?.uid === comment.authorId ? (
                        <>
                          {post?.status === 'OPEN' && (
                            <button onClick={() => { setEditingComment(comment.id); setEditContent(comment.content); setShowMenuFor(null); }} style={{ width: '100%', padding: '12px', border: 'none', background: 'none', textAlign: 'left', fontSize: '14px' }}>수정</button>
                          )}
                          <button onClick={() => { handleDeleteComment(comment.id); setShowMenuFor(null); }} style={{ width: '100%', padding: '12px', border: 'none', background: 'none', textAlign: 'left', fontSize: '14px', color: '#D32F2F' }}>삭제</button>
                        </>
                      ) : (
                        <button onClick={() => alert('신고가 접수되었습니다.')} style={{ width: '100%', padding: '12px', border: 'none', background: 'none', textAlign: 'left', fontSize: '14px', color: '#D32F2F' }}>신고하기</button>
                      )}
                    </div>
                  )}
                </div>

                {/* 대댓글 리스트 */}
                {comment.replies?.map((reply) => (
                  <div key={reply.id} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '8px', gap: '8px', marginLeft: '24px' }}>
                    <div style={{ marginTop: '10px' }}><img src={replyArrowIcon} alt="arrow" style={{ width: '20px', height: '20px' }} /></div>
                    <div style={{ flex: 1, padding: '10px 12px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0', position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ padding: '3px 6px', backgroundColor: reply.authorId === post?.authorId ? '#FFB33128' : (reply.vote === 'innocent' ? '#E3F2FD' : '#FFEBEE'), color: reply.authorId === post?.authorId ? '#B45309' : (reply.vote === 'innocent' ? '#1976D2' : '#D32F2F'), fontSize: '11px', fontWeight: '600', borderRadius: '4px' }}>{reply.authorId === post?.authorId ? '작성자' : (reply.vote === 'innocent' ? '무죄' : '유죄')}</div>
                          <Text color="#6B7684" typography="t7" fontWeight="medium" style={{ fontSize: '13px' }}>{reply.authorNickname.replace(/^배심원/, '')}님</Text>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f2f4f6', borderRadius: '20px', padding: '4px 8px' }}>
                          <button onClick={() => handleLikeReply(comment.id, reply.id)} disabled={post?.status === 'CLOSED'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                            <Asset.Icon frameShape={{ width: 14, height: 14 }} name="icon-thumb-up-mono" color="#9E9E9E" />
                          </button>
                          <div style={{ width: '1px', height: '16px', backgroundColor: '#9E9E9E', opacity: 0.3 }} />
                          <button data-reply-menu-button onClick={() => setShowMenuForReply(showMenuForReply === `${comment.id}_${reply.id}` ? null : `${comment.id}_${reply.id}`)} style={{ background: 'none', border: 'none', padding: '4px' }}>
                            <Asset.Icon frameShape={{ width: 14, height: 14 }} name="icon-dots-vertical-1-mono" color="#9E9E9E" />
                          </button>
                        </div>
                      </div>
                      
                      {editingReply === `${comment.id}_${reply.id}` ? (
                        <div>
                          <textarea value={editReplyContent} onChange={(e) => setEditReplyContent(e.target.value)} style={{ width: '100%', minHeight: '60px', padding: '8px', border: '1px solid #E5E5E5', borderRadius: '4px', fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box' }} />
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setEditingReply(null)} style={{ padding: '6px 12px', backgroundColor: '#f0f0f0', border: 'none', borderRadius: '4px', fontSize: '13px' }}>취소</button>
                            <button onClick={() => handleEditReply(comment.id, reply.id)} style={{ padding: '6px 12px', backgroundColor: '#3182F6', color: 'white', border: 'none', borderRadius: '4px', fontSize: '13px' }}>수정</button>
                          </div>
                        </div>
                      ) : (
                        <Text display="block" color="#191F28" typography="t6" fontWeight="regular">{reply.content}</Text>
                      )}

                      {showMenuForReply === `${comment.id}_${reply.id}` && (
                        <div data-reply-menu style={{ position: 'absolute', top: '40px', right: '12px', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '100px' }}>
                          {user?.uid === reply.authorId ? (
                            <>
                              {post?.status === 'OPEN' && (
                                <button onClick={() => { setEditingReply(`${comment.id}_${reply.id}`); setEditReplyContent(reply.content); setShowMenuForReply(null); }} style={{ width: '100%', padding: '12px', border: 'none', background: 'none', textAlign: 'left', fontSize: '14px' }}>수정</button>
                              )}
                              <button onClick={() => { handleDeleteReply(comment.id, reply.id); setShowMenuForReply(null); }} style={{ width: '100%', padding: '12px', border: 'none', background: 'none', textAlign: 'left', fontSize: '14px', color: '#D32F2F' }}>삭제</button>
                            </>
                          ) : (
                            <button onClick={() => alert('신고가 접수되었습니다.')} style={{ width: '100%', padding: '12px', border: 'none', background: 'none', textAlign: 'left', fontSize: '14px', color: '#D32F2F' }}>신고하기</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 모달 레이어 (투표 확인, 삭제 확인 등) */}
      {showVoteConfirm && pendingVoteType && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={() => setShowVoteConfirm(false)}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <Text display="block" color="#191F28" typography="t4" fontWeight="bold" textAlign="center" style={{ marginBottom: '12px' }}>'{pendingVoteType === 'agree' ? '무죄' : '유죄'}'로 하시겠어요?</Text>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowVoteConfirm(false)} style={{ flex: 1, padding: '12px', backgroundColor: '#F2F4F6', color: '#191F28', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600' }}>닫기</button>
              <button onClick={handleVoteConfirm} style={{ flex: 1, padding: '12px', backgroundColor: '#3182F6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600' }}>완료</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={() => setShowDeleteConfirm(false)}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <Text display="block" color="#191F28" typography="t4" fontWeight="bold" textAlign="center" style={{ marginBottom: '12px' }}>정말 삭제하시겠어요?</Text>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: '12px', backgroundColor: '#f0f0f0', color: '#191F28', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600' }}>취소</button>
              <button onClick={handleDeletePostConfirm} style={{ flex: 1, padding: '12px', backgroundColor: '#3182F6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600' }}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteComplete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
          <div style={{ color: '#666', fontSize: '20px', fontWeight: 'bold', marginBottom: '24px' }}>삭제 완료했어요!</div>
          <button onClick={() => navigate('/')} style={{ padding: '12px 24px', backgroundColor: '#3182F6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600' }}>홈으로</button>
        </div>
      )}
    </div>
  );
}

export default CaseDetailPage;