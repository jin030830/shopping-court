import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Asset } from '@toss/tds-mobile';
import { 
  getCase, 
  deleteCase, 
  addVote, 
  getUserVote, 
  getComments,
  addComment,
  type CaseDocument, 
  type VoteType,
  type CommentDocument,
  type CommentData
} from '../api/cases';
import { Timestamp } from 'firebase/firestore';

function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userData, logout, isLoading: isAuthLoading } = useAuth();
  
  const [post, setPost] = useState<CaseDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPostMenu, setShowPostMenu] = useState(false);

  // Voting State
  const [selectedVote, setSelectedVote] = useState<VoteType | null>(null);
  const [userVote, setUserVote] = useState<VoteType | null>(null);
  const [isVoting, setIsVoting] = useState(false);

  // Comment State
  const [comments, setComments] = useState<CommentDocument[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);

  useEffect(() => {
    if (!id) {
      setError('게시물 ID가 없습니다.');
      setIsLoading(false);
      return;
    }

    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        const caseData = await getCase(id);
        if (caseData) {
          setPost(caseData);
          // Fetch comments only after post is loaded
          const commentsData = await getComments(id);
          setComments(commentsData);

          if (user) {
            const vote = await getUserVote(id, user.uid);
            if (vote) {
              setUserVote(vote);
              setSelectedVote(vote);
            }
          }
        } else {
          setError('게시물을 찾을 수 없습니다.');
        }
      } catch (err) {
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [id, user]);

  const handleLogout = async () => {
    try {
      await logout();
      alert('로그아웃되었습니다.');
      setShowPostMenu(false);
      navigate('/');
    } catch (error) {
      console.error('로그아웃 오류:', error);
      alert('로그아웃에 실패했습니다.');
    }
  };

  const handleDeletePost = async () => {
    if (!id || user?.uid !== post?.authorId) {
      alert('삭제 권한이 없습니다.');
      return;
    }
    if (window.confirm('게시물을 정말 삭제하시겠습니까?')) {
      try {
        await deleteCase(id);
        alert('게시물이 삭제되었습니다.');
        navigate('/');
      } catch (error) {
        console.error('게시물 삭제 실패:', error);
        alert('게시물 삭제에 실패했습니다.');
      }
    }
  };

  const handleEditPost = () => {
    if (user?.uid !== post?.authorId) {
      alert('수정 권한이 없습니다.');
      return;
    }
    navigate(`/edit-post/${id}`);
  };

  const handleVoteClick = async () => {
    if (!id || !user) {
      alert('로그인이 필요합니다.');
      navigate('/terms', { state: { from: location } });
      return;
    }
    if (userVote) {
      alert('이미 투표했습니다.');
      return;
    }
    if (!selectedVote) {
      alert('투표할 항목을 선택해주세요.');
      return;
    }

    setIsVoting(true);
    try {
      await addVote(id, user.uid, selectedVote);
      setUserVote(selectedVote);
      setPost(prevPost => {
        if (!prevPost) return null;
        return {
          ...prevPost,
          guiltyCount: prevPost.guiltyCount + (selectedVote === 'guilty' ? 1 : 0),
          innocentCount: prevPost.innocentCount + (selectedVote === 'innocent' ? 1 : 0),
        };
      });
    } catch (error) {
      console.error(error);
      alert('투표 중 오류가 발생했습니다.');
    } finally {
      setIsVoting(false);
    }
  };

  const handleCommentSubmit = async () => {
    if (!id || !user || !userData) {
      alert('로그인이 필요합니다.');
      return;
    }
    if (!userVote) {
      alert('투표를 먼저 해주세요.');
      return;
    }
    if (!newComment.trim()) {
      alert('댓글 내용을 입력해주세요.');
      return;
    }

    setIsCommenting(true);
    const commentData: CommentData = {
      authorId: user.uid,
      authorNickname: userData.nickname,
      content: newComment.trim(),
      vote: userVote,
    };

    try {
      const tempId = `temp_${Date.now()}`;
      const optimisticComment: CommentDocument = {
        ...commentData,
        id: tempId,
        createdAt: Timestamp.now(),
      };
      setComments(prev => [...prev, optimisticComment]);
      setNewComment('');

      await addComment(id, commentData);
      const updatedComments = await getComments(id);
      setComments(updatedComments);

    } catch (error) {
      console.error('댓글 작성 실패:', error);
      alert('댓글 작성에 실패했습니다.');
      setComments(prev => prev.filter(c => c.id !== `temp_${Date.now()}`)); // Revert optimistic update
    } finally {
      setIsCommenting(false);
    }
  };

  if (isLoading || isAuthLoading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>로딩 중...</div>;
  }

  if (error) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>{error}</div>;
  }

  if (!post) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>게시물을 찾을 수 없습니다.</div>;
  }

  const totalVotes = post.guiltyCount + post.innocentCount;
  const guiltyPercent = totalVotes > 0 ? Math.round((post.guiltyCount / totalVotes) * 100) : 50;
  const innocentPercent = totalVotes > 0 ? Math.round((post.innocentCount / totalVotes) * 100) : 50;

  return (
    <div style={{ backgroundColor: '#F8F9FA', minHeight: '100vh', paddingBottom: '24px' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Asset.Icon name="icon-arrow-left-mono" /></button>
        <div style={{ position: 'relative' }}>
          {user && (
            <>
              <button onClick={() => setShowPostMenu(!showPostMenu)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Asset.Icon name="icon-dots-mono" /></button>
              {showPostMenu && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 1000, minWidth: '120px' }}>
                  {user.uid === post.authorId ? (
                    <>
                      <button onClick={handleEditPost} style={{ width: '100%', padding: '12px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}>수정</button>
                      <button onClick={handleDeletePost} style={{ width: '100%', padding: '12px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', color: '#D32F2F' }}>삭제</button>
                    </>
                  ) : (
                    <button onClick={handleLogout} style={{ width: '100%', padding: '12px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}>로그아웃</button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ height: '16px' }} />

      {/* Post Content */}
      <div style={{ padding: '0 20px' }}>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Asset.Icon name="icon-one-league10-blue" />
            <span>{post.authorNickname} 님</span>
          </div>
          <h2>{post.title}</h2>
          <p>{post.content}</p>
          
          {/* Voting UI */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <button onClick={() => setSelectedVote('innocent')} disabled={!!userVote} style={{ flex: 1, padding: '12px', border: selectedVote === 'innocent' ? '3px solid #1976D2' : '1px solid #ddd', cursor: userVote ? 'not-allowed' : 'pointer' }}>무죄</button>
            <button onClick={() => setSelectedVote('guilty')} disabled={!!userVote} style={{ flex: 1, padding: '12px', border: selectedVote === 'guilty' ? '3px solid #D32F2F' : '1px solid #ddd', cursor: userVote ? 'not-allowed' : 'pointer' }}>유죄</button>
          </div>
          <button onClick={handleVoteClick} disabled={isVoting || !!userVote} style={{ width: '100%', padding: '16px', backgroundColor: (isVoting || !!userVote) ? '#ccc' : '#3182F6', color: 'white', border: 'none', borderRadius: '8px' }}>
            {isVoting ? '투표 중...' : userVote ? '투표 완료' : '투표하기'}
          </button>
        </div>
      </div>

      {/* Vote Results */}
      {userVote && totalVotes > 0 && (
        <div style={{ padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>무죄 {innocentPercent}%</span>
              <span>유죄 {guiltyPercent}%</span>
            </div>
            <div style={{ display: 'flex', height: '8px', backgroundColor: '#f0f0f0' }}>
              <div style={{ width: `${innocentPercent}%`, backgroundColor: '#1976D2' }} />
              <div style={{ width: `${guiltyPercent}%`, backgroundColor: '#D32F2F' }} />
            </div>
          </div>
        </div>
      )}

      {/* Comments Section */}
      <div style={{ padding: '20px' }}>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px' }}>
          <h4>전체 댓글 {comments.length}</h4>
          {userVote && (
            <div>
              <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="의견을 남겨주세요..." style={{ width: '100%', minHeight: '80px', padding: '12px', border: '1px solid #ddd' }} />
              <button onClick={handleCommentSubmit} disabled={isCommenting} style={{ marginTop: '8px', padding: '10px 20px' }}>
                {isCommenting ? '등록 중...' : '댓글 작성'}
              </button>
            </div>
          )}
          <div>
            {comments.map(comment => (
              <div key={comment.id} style={{ borderBottom: '1px solid #eee', padding: '10px 0' }}>
                <p><b>{comment.authorNickname}</b> ({comment.vote === 'innocent' ? '무죄' : '유죄'})</p>
                <p>{comment.content}</p>
                {comment.createdAt && <small>{new Date(comment.createdAt.seconds * 1000).toLocaleString()}</small>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CaseDetailPage;
