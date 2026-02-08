import { useNavigate } from 'react-router-dom';
import { Asset, Text, Spacing } from '@toss/tds-mobile';
import { useRef, useCallback, memo } from 'react';
import { getCasesByAuthorPaginated, type CaseDocument } from '../api/cases';
import { adaptive } from '@toss/tds-colors';
import { useAuth } from '../hooks/useAuth';
import { useInfiniteQuery } from '@tanstack/react-query';

const MyPostItem = memo(({ post, navigate, showVerdict }: any) => {
  let v: '무죄' | '유죄' | '보류' = '보류';
  if (showVerdict && post.status === 'CLOSED') {
    const ic = post.innocentCount || 0, gc = post.guiltyCount || 0;
    v = ic > gc ? '무죄' : gc > ic ? '유죄' : '보류';
  }
  const bg = v === '무죄' ? '#E3F2FD' : v === '유죄' ? '#FFEBEE' : '#F2F4F6';
  const co = v === '무죄' ? '#1976D2' : v === '유죄' ? '#D32F2F' : '#6B7684';
  const d = post.createdAt ? post.createdAt.toDate() : new Date();
  const ds = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

  return (
    <div onClick={() => navigate(`/case/${post.id}`, { state: { fromTab: '내가 쓴 글' } })} style={{ padding: '16px 20px', borderBottom: '1px solid #F0F0F0', cursor: 'pointer', backgroundColor: 'white' }}>
      {showVerdict && post.status === 'CLOSED' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ padding: '4px 10px', backgroundColor: bg, color: co, fontSize: '12px', fontWeight: '600', borderRadius: '4px' }}>{v}</div>
          <Text color="#9E9E9E" typography="st13" style={{ fontSize: '14px' }}>{ds}</Text>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
        <Text display="block" color="#191F28" typography="t4" fontWeight="bold" style={{ flex: 1, textAlign: 'center', WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{post.title}</Text>
        {!showVerdict && post.status === 'OPEN' && <Text color="#9E9E9E" typography="st13" style={{ fontSize: '14px' }}>{ds}</Text>}
      </div>
      <div style={{ marginBottom: '8px', lineHeight: '1.5', color: '#191F28', fontSize: '14px', wordBreak: 'break-word' }}>{post.content && post.content.length > 50 ? `${post.content.substring(0, 50)}...` : post.content}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Asset.Icon frameShape={{ width: 15, height: 15 }} name="icon-user-two-mono" color="#5e403b" /><Text color="#5e403b" typography="st13" style={{ fontSize: '14px' }}>{(post.guiltyCount || 0) + (post.innocentCount || 0)}</Text></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Asset.Icon frameShape={{ width: 15, height: 15 }} name="icon-chat-bubble-mono" color="#5E403Bff" /><Text color="#5e403b" typography="st13" style={{ fontSize: '14px' }}>{post.commentCount ?? 0}</Text></div>
      </div>
    </div>
  );
});

function MyPostsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery<{ cases: CaseDocument[], lastDoc: any }, Error>({
    queryKey: ['cases', 'USER', user?.uid],
    queryFn: ({ pageParam }) => getCasesByAuthorPaginated(user!.uid, pageParam, 15),
    getNextPageParam: (last) => last.cases.length === 15 ? last.lastDoc : undefined,
    initialPageParam: null,
    enabled: !!user?.uid
  });

  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: any) => {
    if (isLoading || isFetchingNextPage) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => { if (entries[0].isIntersecting && hasNextPage) fetchNextPage(); });
    if (node) observer.current.observe(node);
  }, [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage]);

  const pages = data?.pages as any[];
  const allPosts = pages?.flatMap(p => p.cases) || [];
  const open = allPosts.filter(p => p.status === 'OPEN');
  const closed = allPosts.filter(p => p.status === 'CLOSED');

  return (
    <div style={{ backgroundColor: 'white', minHeight: '100vh', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ padding: '0 20px', background: 'linear-gradient(180deg, #F7F3EE 0%, #ffffff 100%)', paddingTop: '16px' }}>
        <Text display="block" color="#191F28" typography="t3" fontWeight="bold" style={{ fontSize: '22px' }}>내가 쓴 글</Text>
        <Text display="block" color="#191F28" typography="t7" fontWeight="regular">내가 참여한 재판 현황을 한눈에 확인하세요</Text>
      </div>
      <Spacing size={38} />
      <Section title="재판 중인 글" iconSrc="https://static.toss.im/2d-emojis/png/4x/u2696.png" posts={open} isLoading={isLoading} showVerdict={false} navigate={navigate} lastRef={closed.length === 0 ? lastElementRef : null} />
      <Spacing size={32} />
      <Section title="이전 재판 기록" iconName="icon-check-circle-mono" posts={closed} isLoading={isLoading} showVerdict={true} navigate={navigate} lastRef={lastElementRef} isNextFetching={isFetchingNextPage} />
      <Spacing size={32} />
    </div>
  );
}

const Section = ({ title, iconSrc, iconName, posts, isLoading, showVerdict, navigate, lastRef, isNextFetching }: any) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 20px', marginBottom: '16px' }}>
      {iconSrc ? <img src={iconSrc} style={{ width: '28px', height: '28px' }} /> : <Asset.Icon frameShape={Asset.frameShape.CleanW24} name={iconName} color="#5e403b" />}
      <Text color={adaptive.grey800} typography="t4" fontWeight="bold" style={{ fontSize: '20px' }}>{title}</Text>
    </div>
    {isLoading && posts.length === 0 ? <div style={{ padding: '40px', textAlign: 'center' }}><Text color="#6B7684">로딩 중...</Text></div> : posts.length === 0 ? <div style={{ padding: '40px', textAlign: 'center' }}><Text color="#6B7684">{title}이 없습니다.</Text></div> : (
      <div>
        <div style={{ height: '1px', backgroundColor: '#F0F0F0', width: '100%' }} />
        {posts.map((p: any, idx: number) => (
          <div key={p.id} ref={idx === posts.length - 1 ? lastRef : null}><MyPostItem post={p} navigate={navigate} showVerdict={showVerdict} /></div>
        ))}
        {isNextFetching && <div style={{ padding: '20px', textAlign: 'center' }}><Text color="#6B7684">더 불러오는 중...</Text></div>}
      </div>
    )}
  </div>
);

export default MyPostsPage;