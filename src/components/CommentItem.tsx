import { memo, useState } from 'react';
import { Asset, Text } from '@toss/tds-mobile';
import { Timestamp } from 'firebase/firestore';
import type { CommentDocument, ReplyDocument, CaseDocument } from '../api/cases';

const formatDate = (timestamp: Timestamp): string => {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return `${month}/${day} ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

interface CommentItemProps {
  comment: CommentDocument & { replies: ReplyDocument[] };
  post: CaseDocument;
  user: { uid: string } | null;
  hasVoted: boolean;
  selectedVote: string | null;
  onLike: (id: string) => void;
  onReply: (id: string) => void;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onLikeReply: (commentId: string, replyId: string) => void;
  onEditReply: (commentId: string, replyId: string, content: string) => void;
  onDeleteReply: (commentId: string, replyId: string) => void;
  onReport: (type: 'comment' | 'reply', targetId: string, commentId?: string, replyId?: string) => void;
  isReplying: boolean;
  replyContent: string;
  onReplyContentChange: (content: string) => void;
  onReplySubmit: (commentId: string) => void;
  onCancelReply: () => void;
  getAuthorLabel: (authorId: string, authorNickname: string) => string;
}

const CommentItem = memo(({ 
  comment, post, user, hasVoted, onLike, onReply, onEdit, onDelete,
  onLikeReply, onEditReply, onDeleteReply, onReport,
  isReplying, replyContent, onReplyContentChange, onReplySubmit, onCancelReply,
  getAuthorLabel
}: CommentItemProps) => {
  const [editingId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [showReplyMenuId, setShowReplyMenuId] = useState<string | null>(null);

  const handleEditStart = () => {
    setEditingCommentId(comment.id);
    setEditContent(comment.content);
    setShowMenu(false);
  };

  const handleEditSubmit = () => {
    onEdit(comment.id, editContent);
    setEditingCommentId(null);
  };

  return (
    <div key={comment.id}>
      <div style={{ padding: '12px 16px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0', position: 'relative', marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {(comment as any).isDeleted ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Asset.Icon 
                  frameShape={Asset.frameShape.CleanW16} 
                  name="icon-info-circle-mono" 
                  color="#B0B8C1" 
                  ratio="1/1" 
                  style={{ transform: 'rotate(180deg)' }}
                />
                <Text color="#B0B8C1" typography="t7" fontWeight="medium" style={{ fontSize: '13px' }}>삭제된 댓글</Text>
              </div>
            ) : (
              <>
                {comment.authorId === post.authorId ? (
                  <div style={{ padding: '3px 6px', backgroundColor: '#FFB33128', borderRadius: '4px', height: 'fit-content', whiteSpace: 'nowrap', fontSize: '11px', fontWeight: '600' }}>
                    <span style={{ color: '#B45309', fontSize: '11px', fontWeight: '600' }}>작성자</span>
                  </div>
                ) : (
                  <div style={{ padding: '3px 6px', backgroundColor: comment.vote === 'innocent' ? '#E3F2FD' : '#FFEBEE', color: comment.vote === 'innocent' ? '#1976D2' : '#D32F2F', fontSize: '11px', fontWeight: '600', borderRadius: '4px', height: 'fit-content', whiteSpace: 'nowrap' }}>{comment.vote === 'innocent' ? '무죄' : '유죄'}</div>
                )}
                <Text color="#6B7684" typography="t7" fontWeight="medium" style={{ fontSize: '13px' }}>{getAuthorLabel(comment.authorId, comment.authorNickname)}</Text>
              </>
            )}
          </div>
          {!(comment as any).isDeleted && (
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f2f4f6', borderRadius: '20px', padding: '4px 8px', gap: '0' }}>
              <button onClick={() => onLike(comment.id)} disabled={post.status === 'CLOSED'} style={{ background: 'none', border: 'none', cursor: post.status === 'CLOSED' ? 'not-allowed' : 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', opacity: post.status === 'CLOSED' ? 0.5 : 1 }}>
                <Asset.Icon frameShape={{ width: 14, height: 14 }} backgroundColor="transparent" name="icon-thumb-up-mono" color="#9E9E9E" aria-hidden={true} ratio="1/1" />
              </button>
              <div style={{ width: '1px', height: '16px', backgroundColor: '#9E9E9E', opacity: 0.3 }} />
              <button onClick={() => { if (post.status === 'CLOSED') return; if (!hasVoted) { alert('투표 후 댓글을 작성할 수 있어요!'); return; } onReply(comment.id); }} disabled={post.status === 'CLOSED'} style={{ background: 'none', border: 'none', cursor: post.status === 'CLOSED' ? 'not-allowed' : 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center', opacity: post.status === 'CLOSED' ? 0.5 : 1 }}>
                <Asset.Icon frameShape={{ width: 14, height: 14 }} backgroundColor="transparent" name="icon-chat-square-two-mono" color="#9E9E9E" aria-hidden={true} ratio="1/1" />
              </button>
              <div style={{ width: '1px', height: '16px', backgroundColor: '#9E9E9E', opacity: 0.3 }} />
              <button onClick={() => { if (post.status === 'CLOSED') return; setShowMenu(!showMenu); }} disabled={post.status === 'CLOSED'} style={{ background: 'none', border: 'none', padding: '4px 8px', display: 'flex', alignItems: 'center', cursor: post.status === 'CLOSED' ? 'not-allowed' : 'pointer', opacity: post.status === 'CLOSED' ? 0.5 : 1 }}>
                <Asset.Icon frameShape={{ width: 14, height: 14 }} backgroundColor="transparent" name="icon-dots-vertical-1-mono" color="#9E9E9E" aria-hidden={true} ratio="1/1" />
              </button>
            </div>
          )}
        </div>

        {editingId === comment.id ? (
          <div>
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} style={{ width: '100%', minHeight: '60px', padding: '8px', border: '1px solid #E5E5E5', borderRadius: '4px', fontSize: '14px', marginBottom: '8px', boxSizing: 'border-box', backgroundColor: 'white', color: '#191F28' }} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingCommentId(null)} style={{ padding: '6px 12px', backgroundColor: '#f0f0f0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>취소</button>
              <button onClick={handleEditSubmit} style={{ padding: '6px 12px', backgroundColor: '#3182F6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>수정</button>
            </div>
          </div>
        ) : (
          <>
            <Text display="block" color={(comment as any).isDeleted ? "#B0B8C1" : "#191F28"} typography="t6" fontWeight="regular" style={{ marginBottom: '4px', whiteSpace: 'pre-wrap', fontStyle: (comment as any).isDeleted ? 'italic' : 'normal' }}>{comment.content}</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Text display="block" color="#9E9E9E" typography="t7" fontWeight="regular" style={{ fontSize: '13px' }}>{formatDate(comment.createdAt)}</Text>
              {!(comment as any).isDeleted && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Asset.Icon frameShape={{ width: 15, height: 15 }} backgroundColor="transparent" name="icon-thumb-up-line-mono" color="#D32F2F" aria-hidden={true} ratio="1/1" />
                  <Text color="#D32F2F" typography="st13" fontWeight="medium" style={{ fontSize: '13px' }}>{comment.likes || 0}</Text>
                </div>
              )}
            </div>
          </>
        )}

        {isReplying && post.status !== 'CLOSED' && (
          <div style={{ marginTop: '12px' }}>
            <textarea value={replyContent} onChange={(e) => onReplyContentChange(e.target.value)} placeholder="답글을 입력하세요..." style={{ width: '100%', minHeight: '60px', padding: '8px', border: '1px solid #E5E5E5', borderRadius: '4px', fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box', backgroundColor: 'white', color: '#191F28' }} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={onCancelReply} style={{ padding: '6px 12px', backgroundColor: '#f0f0f0', border: 'none', borderRadius: '4px', fontSize: '13px' }}>취소</button>
              <button onClick={() => onReplySubmit(comment.id)} style={{ padding: '6px 12px', backgroundColor: '#3182F6', color: 'white', border: 'none', borderRadius: '4px', fontSize: '13px' }}>답글 작성</button>
            </div>
          </div>
        )}

        {showMenu && (
          <div style={{ position: 'absolute', top: '50px', right: '16px', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '100px' }}>
            {user?.uid === comment.authorId ? (
              <>
                {post.status === 'OPEN' && <button onClick={handleEditStart} style={{ width: '100%', padding: '12px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px' }}>수정</button>}
                {post.status === 'OPEN' && <button onClick={() => { onDelete(comment.id); setShowMenu(false); }} style={{ width: '100%', padding: '12px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', color: '#D32F2F' }}>삭제</button>}
              </>
            ) : (
              <button onClick={() => { onReport('comment', comment.id, comment.id); setShowMenu(false); }} style={{ width: '100%', padding: '12px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', color: '#D32F2F' }}>신고하기</button>
            )}
          </div>
        )}
      </div>

      {comment.replies?.map((reply) => (
        <div key={reply.id} style={{ display: 'flex', alignItems: 'flex-start', marginTop: '12px', gap: '8px', marginLeft: '24px' }}>
          <div style={{ marginTop: '10px' }}><Asset.Icon frameShape={{ width: 20, height: 20 }} backgroundColor="transparent" name="icon-enter-right-round-mono" color="#9E9E9E" aria-hidden={true} ratio="1/1" /></div>
          <div style={{ flex: 1, padding: '10px 12px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {reply.authorId === post.authorId ? (
                  <div style={{ padding: '3px 6px', backgroundColor: '#FFB33128', borderRadius: '4px', height: 'fit-content', whiteSpace: 'nowrap', fontSize: '11px', fontWeight: '600' }}>
                    <span style={{ color: '#B45309', fontSize: '11px', fontWeight: '600' }}>작성자</span>
                  </div>
                ) : (
                  <div style={{ padding: '3px 6px', backgroundColor: reply.vote === 'innocent' ? '#E3F2FD' : '#FFEBEE', color: reply.vote === 'innocent' ? '#1976D2' : '#D32F2F', fontSize: '11px', fontWeight: '600', borderRadius: '4px', height: 'fit-content', whiteSpace: 'nowrap' }}>{reply.vote === 'innocent' ? '무죄' : '유죄'}</div>
                )}
                <Text color="#6B7684" typography="t7" fontWeight="medium" style={{ fontSize: '13px' }}>{getAuthorLabel(reply.authorId, reply.authorNickname)}</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f2f4f6', borderRadius: '20px', padding: '4px 8px', gap: '0' }}>
                <button onClick={() => onLikeReply(comment.id, reply.id)} disabled={post.status === 'CLOSED'} style={{ background: 'none', border: 'none', cursor: post.status === 'CLOSED' ? 'not-allowed' : 'pointer', padding: '4px', display: 'flex', alignItems: 'center', gap: '4px', opacity: post.status === 'CLOSED' ? 0.5 : 1 }}>
                  <Asset.Icon frameShape={{ width: 14, height: 14 }} backgroundColor="transparent" name="icon-thumb-up-mono" color="#9E9E9E" aria-hidden={true} ratio="1/1" />
                </button>
                <div style={{ width: '1px', height: '16px', backgroundColor: '#9E9E9E', opacity: 0.3 }} />
                <button onClick={() => { if (post.status === 'CLOSED') return; setShowReplyMenuId(showReplyMenuId === reply.id ? null : reply.id); }} disabled={post.status === 'CLOSED'} style={{ background: 'none', border: 'none', padding: '4px', display: 'flex', alignItems: 'center', cursor: post.status === 'CLOSED' ? 'not-allowed' : 'pointer', opacity: post.status === 'CLOSED' ? 0.5 : 1 }}>
                  <Asset.Icon frameShape={{ width: 14, height: 14 }} backgroundColor="transparent" name="icon-dots-vertical-1-mono" color="#9E9E9E" aria-hidden={true} ratio="1/1" />
                </button>
              </div>
            </div>
            
            {editingReplyId === reply.id ? (
              <div>
                <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} style={{ width: '100%', minHeight: '60px', padding: '8px', border: '1px solid #E5E5E5', borderRadius: '4px', fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box', backgroundColor: 'white', color: '#191F28' }} />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditingReplyId(null)} style={{ padding: '6px 12px', backgroundColor: '#f0f0f0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>취소</button>
                  <button onClick={() => { onEditReply(comment.id, reply.id, editContent); setEditingReplyId(null); }} style={{ padding: '6px 12px', backgroundColor: '#3182F6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>수정</button>
                </div>
              </div>
            ) : (
              <>
                <Text display="block" color="#191F28" typography="t6" fontWeight="regular" style={{ marginBottom: '4px', whiteSpace: 'pre-wrap' }}>{reply.content}</Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Text display="block" color="#9E9E9E" typography="t7" fontWeight="regular" style={{ fontSize: '13px' }}>{formatDate(reply.createdAt)}</Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Asset.Icon frameShape={{ width: 15, height: 15 }} backgroundColor="transparent" name="icon-thumb-up-line-mono" color="#D32F2F" aria-hidden={true} ratio="1/1" />
                    <Text color="#D32F2F" typography="st13" fontWeight="medium" style={{ fontSize: '13px' }}>{reply.likes || 0}</Text>
                  </div>
                </div>
              </>
            )}

            {showReplyMenuId === reply.id && (
              <div style={{ position: 'absolute', top: '40px', right: '12px', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '100px' }}>
                {user?.uid === reply.authorId ? (
                  <>
                    {post.status === 'OPEN' && <button onClick={() => { setEditingReplyId(reply.id); setEditContent(reply.content); setShowReplyMenuId(null); }} style={{ width: '100%', padding: '12px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px' }}>수정</button>}
                    {post.status === 'OPEN' && <button onClick={() => { onDeleteReply(comment.id, reply.id); setShowReplyMenuId(null); }} style={{ width: '100%', padding: '12px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', color: '#D32F2F' }}>삭제</button>}
                  </>
                ) : (
                  <button onClick={() => { onReport('reply', reply.id, comment.id, reply.id); setShowReplyMenuId(null); }} style={{ width: '100%', padding: '12px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', color: '#D32F2F' }}>신고하기</button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
});

export default CommentItem;