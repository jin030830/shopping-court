import { useNavigate } from 'react-router-dom';
import { Asset, Text } from '@toss/tds-mobile';
import { useRef, useCallback, memo, useState, useEffect } from 'react';
import { getCasesPaginated, type CaseDocument } from '../api/cases';
import { adaptive } from '@toss/tds-colors';
import { useInfiniteQuery } from '@tanstack/react-query';
import { CompletedCaseItemSkeleton } from '../components/Skeleton/CaseItemSkeleton';

// 개별 게시물 아이템 (memo 사용)
const CompletedCaseItem = memo(({ post, navigate }: any) => {
  const vc = (post.guiltyCount || 0) + (post.innocentCount || 0);
  const verdict = vc > 0 ? (post.innocentCount > post.guiltyCount ? '무죄' : post.guiltyCount > post.innocentCount ? '유죄' : '보류') : '보류';
  const bg = verdict === '무죄' ? '#E3F2FD' : verdict === '유죄' ? '#FFEBEE' : '#F2F4F6';
  const color = verdict === '무죄' ? '#1976D2' : verdict === '유죄' ? '#D32F2F' : '#6B7684';
  const date = post.voteEndAt ? post.voteEndAt.toDate() : new Date();
  const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

  return (
    <div onClick={() => navigate(`/case/${post.id}`, { state: { fromTab: '재판 완료' } })} style={{ backgroundColor: 'white', padding: '16px 20px', borderBottom: '1px solid #F0F0F0', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ padding: '4px 10px', backgroundColor: bg, color, fontSize: '12px', fontWeight: '600', borderRadius: '4px' }}>{verdict}</div>
        <Text color="#9E9E9E" typography="st13" style={{ fontSize: '14px' }}>{dateStr}</Text>
      </div>
      <div style={{ marginBottom: '4px' }}><Text display="block" color="#191F28" typography="t4" fontWeight="bold" style={{ textAlign: 'center', WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{post.title}</Text></div>
      <div style={{
        marginBottom: '8px',
        lineHeight: '1.5',
        color: '#191F28',
        fontSize: '14px',
        wordBreak: 'break-word',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'pre-wrap'
      }}>
        {post.content}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text color="#9E9E9E" typography="st13" fontWeight="medium" style={{ fontSize: '13px' }}>
          조회수 {post.viewCount || vc}
        </Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Asset.Icon frameShape={{ width: 14, height: 14 }} backgroundColor="transparent" name="icon-chat-bubble-grayline-mono" color="#9E9E9E" aria-hidden={true} ratio="1/1" />
          <Text color="#9E9E9E" typography="st13" fontWeight="medium" style={{ fontSize: '13px' }}>{post.commentCount ?? 0}</Text>
        </div>
      </div>
    </div>
  );
});

function CompletedPreviousPage() {
  const navigate = useNavigate();
  const [sort, setSort] = useState<'최신순' | '인기순'>(
    () => (sessionStorage.getItem('completedPreviousSort') as '최신순' | '인기순') || '최신순'
  );
  const [search, setSearch] = useState('');

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } = useInfiniteQuery<{ cases: CaseDocument[], lastDoc: any }, Error>({
    queryKey: ['cases', 'CLOSED', 'previous'],
    queryFn: ({ pageParam }) => getCasesPaginated({ status: 'CLOSED', limitCount: 15, orderByField: 'voteEndAt', orderDirection: 'desc', lastVisible: pageParam }),
    getNextPageParam: (last) => last.cases.length === 15 ? last.lastDoc : undefined,
    initialPageParam: null
  });

  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: any) => {
    if (isLoading || isFetchingNextPage) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage) fetchNextPage();
    });
    if (node) observer.current.observe(node);
  }, [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage]);

  useEffect(() => { sessionStorage.setItem('completedListFromTab', '재판 완료'); }, []);

  const pages = data?.pages as any[];
  const allPosts = pages?.flatMap(p => p.cases) || [];
  const filtered = allPosts
    .filter(p => {
      if (search.trim() && !p.title.toLowerCase().includes(search.toLowerCase()) && !p.content.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === '최신순') {
        const aTime = a.voteEndAt?.toMillis?.() ?? 0;
        const bTime = b.voteEndAt?.toMillis?.() ?? 0;
        return bTime - aTime;
      }
      const aVotes = (a.guiltyCount || 0) + (a.innocentCount || 0);
      const bVotes = (b.guiltyCount || 0) + (b.innocentCount || 0);
      return bVotes - aVotes;
    });

  return (
    <div style={{ backgroundColor: 'white', minHeight: '100vh', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ padding: '0 20px', paddingTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Asset.Icon frameShape={Asset.frameShape.CleanW24} name="icon-document-folder-yellow" ratio="1/1" />
        <Text display="block" color={adaptive.grey900} typography="t3" fontWeight="bold" style={{ fontSize: '22px' }}>이전 재판 기록</Text>
      </div>

      <div style={{ padding: '0 20px', marginBottom: '16px', position: 'relative' }}>
        <div style={{ position: 'absolute', left: '36px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><Asset.Icon frameShape={{ width: 20, height: 20 }} name="icon-search-mono" color="#9E9E9E" /></div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="관심 키워드 검색" style={{ width: '100%', padding: '12px 16px 12px 44px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '15px', backgroundColor: 'white', color: '#191F28', boxSizing: 'border-box' }} />
      </div>

      <div style={{ padding: '0 20px', marginBottom: '0px', display: 'flex', gap: '8px', borderBottom: '1px solid #F0F0F0', paddingBottom: '12px' }}>
        {(['최신순', '인기순'] as const).map((opt) => (
          <button
            key={opt}
            onClick={() => { setSort(opt); sessionStorage.setItem('completedPreviousSort', opt); }}
            style={{
              padding: '6px 16px',
              backgroundColor: sort === opt ? '#191F28' : '#F2F4F6',
              color: sort === opt ? 'white' : '#666',
              border: 'none',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: sort === opt ? '600' : '400',
              cursor: 'pointer'
            }}
          >
            {opt}
          </button>
        ))}
      </div>

      <div style={{ backgroundColor: 'white' }}>
        {error ? <div style={{ padding: '40px', textAlign: 'center' }}><Text color="#D32F2F">오류가 발생했습니다.</Text></div> : isLoading ? (
          <div>
            {[...Array(5)].map((_, i) => <CompletedCaseItemSkeleton key={`skeleton-${i}`} />)}
          </div>
        ) : filtered.length === 0 ? <div style={{ padding: '40px', textAlign: 'center' }}><Text color="#6B7684">표시할 게시물이 없습니다.</Text></div> : (
          <div>
            {filtered.map((p, idx) => (
              <div key={p.id} ref={idx === filtered.length - 1 ? lastElementRef : null}><CompletedCaseItem post={p} navigate={navigate} /></div>
            ))}
            {isFetchingNextPage && <div style={{ padding: '20px', textAlign: 'center' }}><Text color="#6B7684">더 불러오는 중...</Text></div>}
          </div>
        )}
      </div>
    </div>
  );
}

export default CompletedPreviousPage;