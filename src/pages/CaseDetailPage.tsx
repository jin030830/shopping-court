import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Asset, Text } from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
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
  reportContent,
  type CaseDocument,
  type CommentDocument,
  type ReplyDocument,
  type VoteType,
  type ReportData
} from '../api/cases';
import { getTodayDateString, type UserDocument } from '../api/user';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { caseKeys } from '../constants/queryKeys';
import CountdownTimer from '../components/CountdownTimer';
import CommentItem from '../components/CommentItem';
import { Timestamp } from 'firebase/firestore';

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

  // [Query] 게시물 상세 정보 (진입 시마다 최신화)
  const { data: post, isInitialLoading: isLoadingPost } = useQuery<CaseDocument | null, Error>({
    queryKey: caseKeys.detail(id!),
    queryFn: () => (id ? getCase(id) : Promise.resolve(null)),
    enabled: !!id,
    staleTime: 0, 
    refetchOnWindowFocus: true,
  });

  // [Query] 댓글 및 대댓글 통합 정보
  const { data: comments = [] } = useQuery<CommentWithReplies[], Error>({
    queryKey: caseKeys.comments(id!),
    queryFn: async () => {
      if (!id) return [];
      const commentsData = await getComments(id);
      return await Promise.all(
        commentsData.map(async (comment: CommentDocument) => {
          const replies = await getReplies(id, comment.id);
          return { ...comment, replies };
        })
      );
    },
    enabled: !!id,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // [Query] 현재 사용자의 투표 상태 확인
  const { data: userVoteData } = useQuery<VoteType | null, Error>({
    queryKey: caseKeys.userVote(id!, user?.uid || ''),
    queryFn: () => (id && user && isVerified ? getUserVote(id, user.uid) : Promise.resolve(null)),
    enabled: !!id && !!user && isVerified,
    staleTime: Infinity,
  });

  const hasVoted = !!userVoteData;
  const isAuthor = user?.uid === post?.authorId;
  const selectedVote = userVoteData === 'innocent' ? 'agree' : userVoteData === 'guilty' ? 'disagree' : null;
  
  const isVoteDisabled = hasVoted || post?.status === 'CLOSED';

  // UI States
  const [newComment, setNewComment] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'likes'>('latest');
  const [likedComments, setLikedComments] = useState<Set<string>>(() => {
    if (!id || !user || !isVerified) return new Set();
    try {
      const storageKey = `liked_comments_${id}_${user.uid}`;
      const savedLikes = localStorage.getItem(storageKey);
      return savedLikes ? new Set(JSON.parse(savedLikes)) : new Set();
    } catch (e) { return new Set(); }
  });
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [showVoteConfirm, setShowVoteConfirm] = useState(false);
  const [pendingVoteType, setPendingVoteType] = useState<'agree' | 'disagree' | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteComplete, setShowDeleteComplete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 메뉴 외부 클릭 감지 로직
  const postMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showPostMenu && postMenuRef.current && !postMenuRef.current.contains(e.target as Node)) {
        setShowPostMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPostMenu]);

  // [Mutation] 투표하기
  const addVoteMutation = useMutation({
    mutationFn: ({ voteType }: { voteType: VoteType }) => addVote(id!, user!.uid, voteType),
    onMutate: async ({ voteType }) => {
      await queryClient.cancelQueries({ queryKey: caseKeys.all });
      if (user) await queryClient.cancelQueries({ queryKey: ['user', user.uid] });

      const previousPost = queryClient.getQueryData<CaseDocument>(caseKeys.detail(id!));
      const previousUserData = user ? queryClient.getQueryData<UserDocument | null>(['user', user.uid]) : null;

      queryClient.setQueryData(caseKeys.detail(id!), (old: CaseDocument | undefined) => {
        if (!old) return old;
        return {
          ...old,
          guiltyCount: voteType === 'guilty' ? (old.guiltyCount || 0) + 1 : (old.guiltyCount || 0),
          innocentCount: voteType === 'innocent' ? (old.innocentCount || 0) + 1 : (old.innocentCount || 0),
        };
      });

      queryClient.setQueriesData({ queryKey: caseKeys.lists() }, (oldData: any) => {
        if (!oldData) return oldData;
        const updateCase = (c: any) => c.id === id ? { ...c, guiltyCount: voteType === 'guilty' ? (c.guiltyCount || 0) + 1 : (c.guiltyCount || 0), innocentCount: voteType === 'innocent' ? (c.innocentCount || 0) + 1 : (c.innocentCount || 0) } : c;
        if (oldData.pages) return { ...oldData, pages: oldData.pages.map((p: any) => ({ ...p, cases: p.cases.map(updateCase) })) };
        return Array.isArray(oldData) ? oldData.map(updateCase) : oldData;
      });

      if (user) {
        const today = getTodayDateString();
        queryClient.setQueryData<UserDocument | null>(['user', user.uid], (prev: UserDocument | null | undefined) => {
          if (!prev) return prev;
          const stats = prev.dailyStats || { voteCount: 0, commentCount: 0, postCount: 0, lastActiveDate: today, isLevel1Claimed: false, isLevel2Claimed: false };
          const isNewDay = stats.lastActiveDate !== today;
          return {
            ...prev,
            dailyStats: { ...stats, voteCount: (isNewDay ? 0 : stats.voteCount) + 1, lastActiveDate: today }
          };
        });
      }

      return { previousPost, previousUserData };
    },
    onSettled: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: caseKeys.all, refetchType: 'all' });
        if (user) queryClient.invalidateQueries({ queryKey: ['user', user.uid] });
      }, 500);
    }
  });

  // [Mutation] 댓글 작성
  const addCommentMutation = useMutation({
    mutationFn: (commentData: { authorId: string; authorNickname: string; content: string; vote: VoteType }) => addComment(id!, commentData),
    onMutate: async (newCommentData: any) => {
      await queryClient.cancelQueries({ queryKey: caseKeys.all });
      if (user) await queryClient.cancelQueries({ queryKey: ['user', user.uid] });

      const previousComments = queryClient.getQueryData<CommentWithReplies[]>(caseKeys.comments(id!));
      const previousUserData = user ? queryClient.getQueryData<UserDocument | null>(['user', user.uid]) : null;
      
      const optimisticComment: CommentWithReplies = {
        id: 'temp-' + Date.now(),
        ...newCommentData,
        createdAt: Timestamp.now(),
        likes: 0,
        likedBy: [],
        replies: []
      };
      queryClient.setQueryData(caseKeys.comments(id!), (old: CommentWithReplies[] | undefined) => [optimisticComment, ...(old || [])]);

      queryClient.setQueriesData({ queryKey: caseKeys.lists() }, (oldData: any) => {
        if (!oldData) return oldData;
        const updateCount = (c: any) => c.id === id ? { ...c, commentCount: (c.commentCount || 0) + 1 } : c;
        if (oldData.pages) return { ...oldData, pages: oldData.pages.map((p: any) => ({ ...p, cases: p.cases.map(updateCount) })) };
        return Array.isArray(oldData) ? oldData.map(updateCount) : oldData;
      });

      await queryClient.invalidateQueries({ queryKey: caseKeys.userLists() });

      if (user) {
        const today = getTodayDateString();
        queryClient.setQueryData<UserDocument | null>(['user', user.uid], (prev: UserDocument | null | undefined) => {
          if (!prev) return prev;
          const stats = prev.dailyStats || { voteCount: 0, commentCount: 0, postCount: 0, lastActiveDate: today, isLevel1Claimed: false, isLevel2Claimed: false };
          const isNewDay = stats.lastActiveDate !== today;
          return {
            ...prev,
            dailyStats: { ...stats, commentCount: (isNewDay ? 0 : stats.commentCount) + 1, lastActiveDate: today }
          };
        });
      }

      setNewComment('');
      return { previousComments, previousUserData };
    },
    onError: (_err: any, _vars: any, context: any) => {
      queryClient.setQueryData(caseKeys.comments(id!), context?.previousComments);
      if (user) queryClient.setQueryData(['user', user.uid], context?.previousUserData);
    },
    onSettled: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: caseKeys.all, refetchType: 'all' });
        if (user) queryClient.invalidateQueries({ queryKey: ['user', user.uid] });
      }, 500);
    }
  });

  // [Mutation] 답글 작성
  const addReplyMutation = useMutation({
    mutationFn: ({ commentId, replyData }: { commentId: string; replyData: any }) => addReply(id!, commentId, replyData),
    onMutate: async ({ commentId, replyData }: any) => {
      await queryClient.cancelQueries({ queryKey: caseKeys.all });
      if (user) await queryClient.cancelQueries({ queryKey: ['user', user.uid] });

      const previousComments = queryClient.getQueryData<CommentWithReplies[]>(caseKeys.comments(id!));
      const previousUserData = user ? queryClient.getQueryData<UserDocument | null>(['user', user.uid]) : null;

      queryClient.setQueryData(caseKeys.comments(id!), (old: CommentWithReplies[] | undefined) => {
        if (!old) return old;
        return old.map((comment: CommentWithReplies) => comment.id === commentId ? { ...comment, replies: [...(comment.replies || []), { id: 'temp-reply-' + Date.now(), ...replyData, createdAt: Timestamp.now(), likes: 0, likedBy: [] }] } : comment);
      });

      queryClient.setQueriesData({ queryKey: caseKeys.lists() }, (oldData: any) => {
        if (!oldData) return oldData;
        const updateCount = (c: any) => c.id === id ? { ...c, commentCount: (c.commentCount || 0) + 1 } : c;
        if (oldData.pages) return { ...oldData, pages: oldData.pages.map((p: any) => ({ ...p, cases: p.cases.map(updateCount) })) };
        return Array.isArray(oldData) ? oldData.map(updateCount) : oldData;
      });

      if (user) {
        const today = getTodayDateString();
        queryClient.setQueryData<UserDocument | null>(['user', user.uid], (prev: UserDocument | null | undefined) => {
          if (!prev) return prev;
          const stats = prev.dailyStats || { voteCount: 0, commentCount: 0, postCount: 0, lastActiveDate: today, isLevel1Claimed: false, isLevel2Claimed: false };
          const isNewDay = stats.lastActiveDate !== today;
          return {
            ...prev,
            dailyStats: { ...stats, commentCount: (isNewDay ? 0 : stats.commentCount) + 1, lastActiveDate: today }
          };
        });
      }

      setReplyContent('');
      setReplyingTo(null);
      return { previousComments, previousUserData };
    },
    onError: (_err: any, _vars: any, context: any) => {
      queryClient.setQueryData(caseKeys.comments(id!), context?.previousComments);
      if (user) queryClient.setQueryData(['user', user.uid], context?.previousUserData);
    },
    onSettled: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: caseKeys.all, refetchType: 'all' });
        if (user) queryClient.invalidateQueries({ queryKey: ['user', user.uid] });
      }, 500);
    }
  });

  // [Mutation] 게시물 삭제
  const deletePostMutation = useMutation({
    mutationFn: () => deleteCase(id!),
    onMutate: () => setIsDeleting(true),
    onSuccess: () => {
      setIsDeleting(false);
      setShowDeleteComplete(true);
    },
    onSettled: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: caseKeys.all, refetchType: 'all' });
      }, 500);
    },
    onError: () => {
      setIsDeleting(false);
      alert('게시물 삭제에 실패했어요.');
    }
  });

  // [Mutation] 신고하기
  const reportMutation = useMutation({
    mutationFn: (reportData: Omit<ReportData, 'createdAt'>) => reportContent(reportData),
    onSuccess: () => {
      alert('신고가 접수되었어요!');
    },
    onError: () => {
      alert('신고 접수에 실패했어요. 다시 시도해주세요.');
    }
  });

  // --- 비즈니스 로직 핸들러 ---

  const handleReport = (targetType: 'case' | 'comment' | 'reply', targetId: string, commentId?: string, replyId?: string) => {
    if (!user) { login(); return; }
    
    reportMutation.mutate({
      reporterId: user.uid,
      targetType,
      targetId,
      caseId: id!,
      commentId,
      replyId
    });
    
    setShowPostMenu(false);
  };

  const handleLikeComment = async (commentId: string) => {
    if (!id || !user || !isVerified || post?.status === 'CLOSED') return;
    if (!hasVoted) { alert('투표 후 공감할 수 있어요!'); return; }
    if (likedComments.has(commentId)) { alert('이미 공감한 댓글이에요!'); return; }
    
    try {
      await addCommentLike(id, commentId);
      queryClient.invalidateQueries({ queryKey: caseKeys.comments(id!) });
      const nextLikes = new Set(likedComments).add(commentId);
      setLikedComments(nextLikes);
      localStorage.setItem(`liked_comments_${id}_${user.uid}`, JSON.stringify(Array.from(nextLikes)));
    } catch (e) { console.error(e); }
  };

  const handleLikeReply = async (commentId: string, replyId: string) => {
    if (!id || !user || !isVerified || post?.status === 'CLOSED') return;
    if (!hasVoted) { alert('투표 후 공감할 수 있어요!'); return; }
    
    const likeKey = `${commentId}_${replyId}`;
    if (likedComments.has(likeKey)) { alert('이미 공감한 댓글이에요!'); return; }
    
    try {
      await addReplyLike(id, commentId, replyId);
      queryClient.invalidateQueries({ queryKey: caseKeys.comments(id!) });
      const nextLikes = new Set(likedComments).add(likeKey);
      setLikedComments(nextLikes);
      localStorage.setItem(`liked_comments_${id}_${user.uid}`, JSON.stringify(Array.from(nextLikes)));
    } catch (e) { console.error(e); }
  };

  // --- 배심원 번호 매핑 로직 ---
  const jurorMap = useMemo(() => {
    if (!post || !comments) return new Map<string, string>();
    
    const map = new Map<string, string>();
    const interactions: { authorId: string; createdAt: any }[] = [];
    
    comments.forEach(comment => {
      interactions.push({ authorId: comment.authorId, createdAt: comment.createdAt });
      comment.replies.forEach(reply => {
        interactions.push({ authorId: reply.authorId, createdAt: reply.createdAt });
      });
    });

    // 시간순 정렬 (먼저 작성한 사람이 1번)
    interactions.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));

    let jurorCount = 1;
    interactions.forEach(({ authorId }) => {
      if (authorId === post.authorId) return; // 글 작성자는 제외
      if (!map.has(authorId)) {
        map.set(authorId, `배심원 ${jurorCount}`);
        jurorCount++;
      }
    });
    
    return map;
  }, [post, comments]);

  const getAuthorLabel = (authorId: string, authorNickname: string) => {
    if (post && authorId === post.authorId) {
       return `피고인 ${authorNickname.replace(/^배심원/, '')}`;
    }
    return jurorMap.get(authorId) || authorNickname;
  };

  // --- 데이터 가공 ---
  const totalVotes = useMemo(() => (post?.innocentCount || 0) + (post?.guiltyCount || 0), [post]);
  const agreePercent = useMemo(() => totalVotes > 0 ? Math.round(((post?.innocentCount || 0) / totalVotes) * 100) : 50, [post, totalVotes]);
  const disagreePercent = useMemo(() => totalVotes > 0 ? Math.round(((post?.guiltyCount || 0) / totalVotes) * 100) : 50, [post, totalVotes]);

  const sortedComments = useMemo(() => {
    return [...comments].sort((a, b) => {
      if (sortBy === 'latest') return (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0);
      return (b.likes || 0) - (a.likes || 0);
    });
  }, [comments, sortBy]);

  // --- 얼리 리턴 (순서 조정) ---
  if (showDeleteComplete) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
        <svg width="100" height="100" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: '24px' }}>
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="#3182F6" />
        </svg>
        <div style={{ color: '#666', fontSize: '20px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center' }}>삭제 완료했어요!</div>
        <button onClick={() => navigate('/')} style={{ padding: '12px 24px', backgroundColor: '#3182F6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', minWidth: '120px' }}>홈으로</button>
      </div>
    );
  }

  if (isDeleting) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #3182F6', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
        <Text color="#191F28" typography="t5" fontWeight="medium">게시글을 삭제하고 있어요</Text>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (isLoadingPost) return <FullPageLoading />;
  if (!post) return <NotFoundView onBack={handleBack} />;

  return (
    <div style={{ backgroundColor: '#F8F9FA', minHeight: '100vh', paddingBottom: '24px', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ height: '12px', backgroundColor: '#F8F9FA' }} />

      <div style={{ padding: '0 13px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ backgroundColor: 'white', padding: '2px 13px 16px 13px', borderRadius: '12px', width: '100%', boxSizing: 'border-box', maxWidth: '100%', overflow: 'hidden', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '0px', marginTop: '10px' }}>
              <Asset.Image frameShape={{ width: 20, height: 20 }} backgroundColor="transparent" src="https://static.toss.im/ml-product/tosst-inapp_tdvjdh3nb4l5yg4xp9a734u4.png" aria-hidden={true} style={{ aspectRatio: '1/1' }} />
              <span style={{ color: '#666', fontSize: '13px' }}>피고인 {post.authorNickname.replace(/^배심원/, '')}</span>
            </div>
            
            <div style={{ position: 'relative', marginTop: '8px' }} ref={postMenuRef}>
              <button onClick={() => setShowPostMenu(!showPostMenu)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Asset.Icon frameShape={Asset.frameShape.CleanW20} name="icon-dots-mono" color="rgba(0, 19, 43, 0.58)" />
              </button>
              {showPostMenu && (
                <div style={{ position: 'absolute', top: '100%', right: '0', marginTop: '8px', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 1000, minWidth: '120px' }}>
                  {user?.uid === post.authorId ? (
                    <>
                      {post.status === 'OPEN' && <button onClick={() => { navigate(`/edit-post/${id}`); setShowPostMenu(false); }} style={{ width: '100%', padding: '12px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', color: '#191F28' }}>수정</button>}
                      <button onClick={() => { setShowDeleteConfirm(true); setShowPostMenu(false); }} style={{ width: '100%', padding: '12px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', color: '#D32F2F' }}>삭제</button>
                    </>
                  ) : (
                    <button onClick={() => handleReport('case', id!)} style={{ width: '100%', padding: '12px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', color: '#D32F2F' }}>신고하기</button>
                  )}
                </div>
              )}
            </div>
          </div>

          <h2 style={{ color: '#191F28', fontSize: '20px', fontWeight: '700', marginBottom: '6px', textAlign: 'center'}}>{post.title}</h2>
          <p style={{ color: '#191F28', fontSize: '15px', fontWeight: '400', marginBottom: '20px', lineHeight: '1.6', textAlign: 'left', paddingLeft: '8px', whiteSpace: 'pre-wrap' }}>{post.content}</p>

          <div style={{ position: 'relative', marginBottom: '26px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { if (isVoteDisabled) return; setPendingVoteType('agree'); setShowVoteConfirm(true); }} disabled={isVoteDisabled} style={{ flex: 1, padding: '12px', backgroundColor: '#E3F2FD', color: '#1976D2', border: selectedVote === 'agree' ? '3px solid #1976D2' : 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: isVoteDisabled ? 'not-allowed' : 'pointer', opacity: isVoteDisabled && selectedVote !== 'agree' ? 0.5 : 1 }}>무죄</button>
              <button onClick={() => { if (isVoteDisabled) return; setPendingVoteType('disagree'); setShowVoteConfirm(true); }} disabled={isVoteDisabled} style={{ flex: 1, padding: '12px', backgroundColor: '#FFEBEE', color: '#D32F2F', border: selectedVote === 'disagree' ? '3px solid #D32F2F' : 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: isVoteDisabled ? 'not-allowed' : 'pointer', opacity: isVoteDisabled && selectedVote !== 'disagree' ? 0.5 : 1 }}>유죄</button>
            </div>
            <CountdownTimer voteEndAt={post.voteEndAt} status={post.status} />
          </div>
        </div>
      </div>

      {(post.status === 'CLOSED' || hasVoted) && totalVotes > 0 && (
        <div style={{ padding: '12px 13px 0 13px', width: '100%', boxSizing: 'border-box' }}>
          <VoteResultView agree={agreePercent} disagree={disagreePercent} total={totalVotes} isClosed={post.status === 'CLOSED'} />
        </div>
      )}

      <div style={{ height: '12px' }} />

      <div style={{ padding: '0 13px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ backgroundColor: 'white', padding: '20px 13px', borderRadius: '12px', width: '100%', boxSizing: 'border-box', maxWidth: '100%', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ color: '#191F28', fontSize: '17px', fontWeight: '600', margin: 0 }}>전체 댓글 {comments.length + comments.reduce((s: number, c: any) => s + c.replies.length, 0)}</h4>
            <SortButtons sortBy={sortBy} onSortChange={setSortBy} />
          </div>

          {(hasVoted || isAuthor) && post.status === 'OPEN' ? (
            <CommentInput value={newComment} onChange={setNewComment} onSubmit={() => {
              if (addCommentMutation.isPending || !newComment.trim()) return;
              addCommentMutation.mutate({ authorId: user!.uid, authorNickname: userData!.nickname, content: newComment, vote: userVoteData || 'innocent' });
            }} isPending={addCommentMutation.isPending} />
          ) : !hasVoted && post.status === 'OPEN' ? (
            <VoteRequiredMessage />
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sortedComments.map((comment) => (
              <CommentItem 
                key={comment.id}
                comment={comment}
                post={post}
                user={user}
                hasVoted={hasVoted}
                selectedVote={selectedVote}
                onLike={handleLikeComment}
                onReply={setReplyingTo}
                onEdit={(cid: string, content: string) => updateComment(id!, cid, content).then(() => queryClient.invalidateQueries({ queryKey: caseKeys.comments(id!) }))}
                onDelete={(cid: string) => { if(window.confirm('댓글을 삭제하시겠어요?')) deleteComment(id!, cid).then(() => { 
                  queryClient.invalidateQueries({ queryKey: caseKeys.comments(id!) });
                  queryClient.invalidateQueries({ queryKey: caseKeys.lists() });
                  queryClient.invalidateQueries({ queryKey: caseKeys.userLists() });
                }) }}
                onLikeReply={handleLikeReply}
                onEditReply={(cid: string, rid: string, content: string) => updateReply(id!, cid, rid, content).then(() => queryClient.invalidateQueries({ queryKey: caseKeys.comments(id!) }))}
                onDeleteReply={(cid: string, rid: string) => { if(window.confirm('답글을 삭제하시겠어요?')) deleteReply(id!, cid, rid).then(() => { 
                  queryClient.invalidateQueries({ queryKey: caseKeys.comments(id!) });
                  queryClient.invalidateQueries({ queryKey: caseKeys.lists() });
                  queryClient.invalidateQueries({ queryKey: caseKeys.userLists() });
                }) }}
                onReport={(type, targetId, cid, rid) => handleReport(type, targetId, cid, rid)}
                isReplying={replyingTo === comment.id}
                replyContent={replyContent}
                onReplyContentChange={setReplyContent}
                onReplySubmit={(cid: string) => {
                  if (!replyContent.trim() || !user || !userData || !userVoteData) return;
                  addReplyMutation.mutate({ 
                    commentId: cid, 
                    replyData: { authorId: user.uid, authorNickname: userData.nickname, content: replyContent, vote: userVoteData } 
                  });
                }}
                onCancelReply={() => setReplyingTo(null)}
                getAuthorLabel={getAuthorLabel}
              />
            ))}
          </div>
        </div>
      </div>

      {showVoteConfirm && <VoteConfirmModal type={pendingVoteType!} onCancel={() => setShowVoteConfirm(false)} onConfirm={() => {
        if (!pendingVoteType || !id || !post || addVoteMutation.isPending) return;
        if (!user || !userData || !isVerified) { login(); return; }
        addVoteMutation.mutate({ voteType: pendingVoteType === 'agree' ? 'innocent' : 'guilty' });
        setShowVoteConfirm(false);
      }} />}
      
      {showDeleteConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '400px', boxSizing: 'border-box' }}>
            <Text display="block" color="#191F28" typography="t4" fontWeight="bold" textAlign="center" style={{ marginBottom: '12px' }}>정말 삭제하시겠어요?</Text>
            <Text display="block" color="#191F28" typography="t7" fontWeight="regular" textAlign="center" style={{ marginBottom: '24px' }}>한 번 삭제하면 복원은 어려워요!</Text>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', color: '#191F28', border: 'none' }}>취소</button>
              <button onClick={() => { setShowDeleteConfirm(false); deletePostMutation.mutate(); }} style={{ flex: 1, padding: '12px', backgroundColor: '#3182F6', color: 'white', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', border: 'none' }}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {isDeleting && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #3182F6', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
          <Text color="#191F28" typography="t5" fontWeight="medium">게시글을 삭제하고 있어요</Text>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {showDeleteComplete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <svg width="100" height="100" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: '24px' }}>
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="#3182F6" />
          </svg>
          <div style={{ color: '#666', fontSize: '20px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center' }}>삭제 완료했어요!</div>
          <button onClick={() => navigate('/')} style={{ padding: '12px 24px', backgroundColor: '#3182F6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', minWidth: '120px' }}>홈으로</button>
        </div>
      )}
    </div>
  );
}

const VoteResultView = ({ agree, disagree, total, isClosed }: { agree: number; disagree: number; total: number; isClosed: boolean }) => (
  <div style={{ backgroundColor: 'white', padding: '20px 15px', borderRadius: '12px', width: '100%', boxSizing: 'border-box', maxWidth: '100%', overflow: 'hidden' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
      <span style={{ color: '#1976D2', fontSize: '18px', fontWeight: '700' }}>{agree}%</span>
      <span style={{ color: '#666', fontSize: '14px' }}>{isClosed ? `${total}명 재판 완료` : `${total}명 투표 중`}</span>
      <span style={{ color: '#D32F2F', fontSize: '18px', fontWeight: '700' }}>{disagree}%</span>
    </div>
    <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#f0f0f0' }}>
      <div style={{ width: `${agree}%`, backgroundColor: '#1976D2' }} />
      <div style={{ width: `${disagree}%`, backgroundColor: '#D32F2F' }} />
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
      <span style={{ color: '#666', fontSize: '13px' }}>무죄</span>
      <span style={{ color: '#666', fontSize: '13px' }}>유죄</span>
    </div>
  </div>
);

const SortButtons = ({ sortBy, onSortChange }: { sortBy: 'latest' | 'likes'; onSortChange: (val: 'latest' | 'likes') => void }) => (
  <div style={{ display: 'flex', gap: '8px' }}>
    {(['latest', 'likes'] as const).map((type) => (
      <button key={type} onClick={() => onSortChange(type)} style={{ padding: '6px 12px', backgroundColor: sortBy === type ? '#3182F6' : 'transparent', color: sortBy === type ? 'white' : '#666', border: '1px solid #ddd', borderRadius: '16px', fontSize: '13px', cursor: 'pointer' }}>
        {type === 'latest' ? '최신순' : '공감순'}
      </button>
    ))}
  </div>
);

const CommentInput = ({ value, onChange, onSubmit, isPending }: { value: string; onChange: (v: string) => void; onSubmit: () => void; isPending: boolean }) => (
  <div style={{ marginBottom: '20px', width: '100%', boxSizing: 'border-box', display: 'block' }}>
    <textarea 
      value={value} 
      onChange={(e) => onChange(e.target.value)} 
      placeholder="의견을 남겨주세요..." 
      style={{ 
        width: '100%', 
        minWidth: '100%',
        minHeight: '80px', 
        padding: '12px', 
        border: '1px solid #E5E5E5', 
        borderRadius: '8px', 
        fontSize: '14px', 
        resize: 'none', 
        boxSizing: 'border-box', 
        backgroundColor: 'white', 
        color: '#191F28',
        display: 'block',
        marginBottom: '8px',
        lineHeight: '1.5',
        whiteSpace: 'pre-wrap',
        overflow: 'hidden'
      }} 
    />
    <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
      <button 
        onClick={onSubmit} 
        disabled={isPending} 
        style={{ 
          padding: '10px 20px', 
          backgroundColor: '#3182F6', 
          color: 'white', 
          border: 'none', 
          borderRadius: '8px', 
          fontSize: '14px', 
          fontWeight: '600', 
          cursor: isPending ? 'not-allowed' : 'pointer',
          opacity: isPending ? 0.7 : 1
        }}
      >
        {isPending ? '작성 중...' : '댓글 작성'}
      </button>
    </div>
  </div>
);

const VoteRequiredMessage = () => (
  <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#F7F3EE', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
    <Asset.Image frameShape={{ width: 22, height: 22 }} backgroundColor="transparent" src="https://static.toss.im/icons/svg/svg/png/4x/icon-chat-bubble-dots-grey300.png" aria-hidden={true} style={{ aspectRatio: '1/1' }} />
    <Text color={adaptive.grey700} typography="t6" fontWeight="regular">투표 후 댓글을 작성할 수 있어요</Text>
  </div>
);

const FullPageLoading = () => (
  <div style={{ padding: '40px 20px', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F9FA' }}>
    <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #3182F6', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
    <Text color="#6B7684">게시물을 불러오고 있습니다...</Text>
    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
  </div>
);

const NotFoundView = ({ onBack }: { onBack: () => void }) => (
  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F9FA', zIndex: 2000, overflow: 'hidden' }}>
    <div style={{ marginBottom: '24px' }}>
      <Asset.Icon 
        frameShape={{ width: 64, height: 64 }} 
        name="icon-info-circle-mono" 
        color="#B0B8C1" 
        style={{ transform: 'rotate(180deg)' }}
      />
    </div>
    <Text display="block" typography="t4" fontWeight="bold" color="#191F28" style={{ marginBottom: '12px' }}>삭제된 게시물이에요</Text>
    <Text display="block" typography="t6" color="#6B7684" style={{ marginBottom: '32px' }}>작성자가 연결을 끊었거나<br />게시물이 삭제되어 볼 수 없어요.</Text>
    <button onClick={onBack} style={{ width: '100%', maxWidth: '200px', padding: '14px 24px', backgroundColor: '#3182F6', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>홈으로 돌아가기</button>
  </div>
);

const VoteConfirmModal = ({ type, onCancel, onConfirm }: { type: 'agree' | 'disagree'; onCancel: () => void; onConfirm: () => void }) => (
  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
    <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '400px', boxSizing: 'border-box' }}>
      <Text display="block" color="#191F28" typography="t4" fontWeight="bold" textAlign="center" style={{ marginBottom: '12px', fontSize: '20px' }}>'{type === 'agree' ? '무죄' : '유죄'}'로 하시겠어요?</Text>
      <Text display="block" color="#191F28" typography="t7" fontWeight="regular" textAlign="center" style={{ marginBottom: '24px', fontSize: '14px' }}>한 번 재판 완료하면 수정할 수 없어요!</Text>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '12px', backgroundColor: '#F2F4F6', borderRadius: '8px', fontWeight: '600', color: '#191F28', border: 'none', cursor: 'pointer' }}>닫기</button>
        <button onClick={onConfirm} style={{ flex: 1, padding: '12px', backgroundColor: '#3182F6', color: 'white', borderRadius: '8px', fontWeight: '600', border: 'none', cursor: 'pointer' }}>완료</button>
      </div>
    </div>
  </div>
);

export default CaseDetailPage;
