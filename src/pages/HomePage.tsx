import { useNavigate, useLocation } from 'react-router-dom';
import { Asset, Text, Spacing } from '@toss/tds-mobile';
import { useState, useEffect } from 'react';
import { getAllCases, getComments, getReplies, type CaseDocument } from '../api/cases';
import { Timestamp } from 'firebase/firestore';
import { adaptive } from '@toss/tds-colors';
import scaleIcon from '../assets/저울모양-다음에서-변환-png.svg';
import gavelIcon from '../assets/판사봉.png';
import hotFlameIcon from '../assets/핫게시판불모양.png';
import commentIcon from '../assets/댓글수-다음에서-변환-png.svg';
import voteIcon from '../assets/투표수-다음에서-변환-png.svg';
import pointMissionImage from '../assets/포인트미션창.png';

// 날짜 포맷팅 함수 (M/d HH:mm 형식)
const formatDate = (timestamp: Timestamp): string => {
  const date = timestamp.toDate();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return `${month}/${day} ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

function HomePage() {
  const location = useLocation();
  const [selectedTab, setSelectedTab] = useState((location.state as any)?.selectedTab || '재판 중');
  const [allPosts, setAllPosts] = useState<CaseDocument[]>([]);
  const [isPostsLoading, setIsPostsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedFilter, setCompletedFilter] = useState<'전체' | '무죄' | '유죄' | '보류'>('전체');
  const [searchKeyword, setSearchKeyword] = useState('');
  const navigate = useNavigate();

  // location.state에서 탭 정보를 받아오면 탭 변경
  // 또는 sessionStorage에서 가져오기 (토스 앱의 뒤로가기 버튼 대응)
  useEffect(() => {
    let newTab: string | null = null;
    
    // location.state에서 먼저 확인
    if ((location.state as any)?.selectedTab) {
      newTab = (location.state as any).selectedTab;
    } 
    // sessionStorage에서 확인 (토스 앱의 뒤로가기 버튼 대응)
    else if (sessionStorage.getItem('caseDetailFromTab')) {
      newTab = sessionStorage.getItem('caseDetailFromTab');
      sessionStorage.removeItem('caseDetailFromTab'); // 사용 후 삭제
    }
    
    if (newTab) {
      setSelectedTab(newTab);
      // state를 초기화하여 다시 뒤로가기 해도 계속 같은 탭이 선택되지 않도록
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        setIsPostsLoading(true);
        const cases = await getAllCases();
        setAllPosts(cases);
      } catch (err) {
        setError('게시물을 불러오는 중 오류가 발생했습니다.');
        console.error(err);
      } finally {
        setIsPostsLoading(false);
      }
    };

    fetchCases();
  }, []);

  return (
    <div style={{ 
      backgroundColor: 'white', 
      minHeight: '100vh',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <Spacing size={14} />

      {/* 포인트 미션 배너 */}
      <div style={{
        backgroundColor: '#f2f4f6',
        padding: '12px 20px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{
          width: '100%',
          height: '144px',
          backgroundColor: '#e8f3ff',
          borderRadius: '10px',
          padding: '12px',
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            position: 'relative',
            zIndex: 1,
            height: '100%'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <Asset.Icon
                frameShape={{ width: 49, height: 49 }}
                backgroundColor="transparent"
                name="icon-money-bag-point-blue-gradient"
                aria-hidden={true}
                ratio="1/1"
              />
              <div style={{ flex: 1 }}>
                <Text
                  display="block"
                  color={adaptive.grey800}
                  typography="t5"
                  fontWeight="bold"
                  style={{ lineHeight: '1.4' }}
                >
                  재판에 참여하고{'\n'}포인트를 모아보세요
                </Text>
              </div>
              <Asset.Icon
                frameShape={Asset.frameShape.CleanW16}
                backgroundColor="transparent"
                name="icon-info-circle"
                aria-hidden={true}
                ratio="1/1"
              />
            </div>
            
            <div 
              style={{ 
                marginTop: 'auto',
                cursor: 'pointer',
                width: 'fit-content'
              }}
              onClick={() => navigate('/point-mission')}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                backgroundColor: '#3182f6',
                borderRadius: '10px',
                boxShadow: '0px 0px 4px 0px rgba(0, 0, 0, 0.25)',
                width: 'fit-content'
              }}>
                <Asset.Icon
                  frameShape={Asset.frameShape.CleanW20}
                  backgroundColor="transparent"
                  name="icon-emoji-sparkles"
                  aria-hidden={true}
                  ratio="1/1"
                />
                <Text
                  display="block"
                  color="white"
                  typography="t6"
                  fontWeight="bold"
                >
                  포인트 미션
                </Text>
                <Asset.Icon
                  frameShape={Asset.frameShape.CleanW16}
                  backgroundColor="transparent"
                  name="icon-arrow-right-mono"
                  color="white"
                  aria-hidden={true}
                  ratio="1/1"
                />
              </div>
            </div>
          </div>
          
          {/* 판사봉 이미지 (배경) */}
          <div style={{
            position: 'absolute',
            bottom: '-10px',
            right: '20px',
            zIndex: 0
          }}>
            <img 
              src={pointMissionImage} 
              alt="포인트 미션" 
              style={{ 
                width: '120px', 
                height: '120px',
                objectFit: 'contain'
              }} 
            />
          </div>
        </div>
      </div>

      <Spacing size={12} />

      {/* 탭 */}
      <div style={{ padding: '0 20px', backgroundColor: 'white', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e5e5', justifyContent: 'space-between' }}>
          <button
            onClick={() => setSelectedTab('재판 중')}
            style={{
              background: 'none',
              border: 'none',
              padding: '12px 0',
              cursor: 'pointer',
              position: 'relative',
              fontWeight: selectedTab === '재판 중' ? '600' : '400',
              color: selectedTab === '재판 중' ? '#191F28' : '#666',
              fontSize: '15px',
              flex: 1,
              textAlign: 'center'
            }}
          >
            재판 중
            {selectedTab === '재판 중' && (
              <div style={{
                position: 'absolute',
                bottom: '-1px',
                left: 0,
                right: 0,
                height: '2px',
                backgroundColor: '#191F28'
              }} />
            )}
          </button>
          <button
            onClick={() => setSelectedTab('HOT 게시판')}
            style={{
              background: 'none',
              border: 'none',
              padding: '12px 0',
              cursor: 'pointer',
              position: 'relative',
              fontWeight: selectedTab === 'HOT 게시판' ? '600' : '400',
              color: selectedTab === 'HOT 게시판' ? '#191F28' : '#666',
              fontSize: '15px',
              flex: 1,
              textAlign: 'center'
            }}
          >
            HOT 게시판
            {selectedTab === 'HOT 게시판' && (
              <div style={{
                position: 'absolute',
                bottom: '-1px',
                left: 0,
                right: 0,
                height: '2px',
                backgroundColor: '#191F28'
              }} />
            )}
          </button>
          <button
            onClick={() => setSelectedTab('재판 완료')}
            style={{
              background: 'none',
              border: 'none',
              padding: '12px 0',
              cursor: 'pointer',
              position: 'relative',
              fontWeight: selectedTab === '재판 완료' ? '600' : '400',
              color: selectedTab === '재판 완료' ? '#191F28' : '#666',
              fontSize: '15px',
              flex: 1,
              textAlign: 'center'
            }}
          >
            재판 완료
            {selectedTab === '재판 완료' && (
              <div style={{
                position: 'absolute',
                bottom: '-1px',
                left: 0,
                right: 0,
                height: '2px',
                backgroundColor: '#191F28'
              }} />
            )}
          </button>
        </div>
      </div>

      {/* 재판 중 탭일 때만 표시되는 섹션 */}
      {selectedTab === '재판 중' && (
        <div style={{ 
          padding: '0 20px', 
          marginBottom: '20px',
          background: 'linear-gradient(180deg, #e8f3ff 0%, #ffffff 100%)',
          paddingTop: '16px',
          marginTop: '-12px'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <div style={{ flex: 1 }}>
              <Text 
                display="block" 
                color="#191F28ff" 
                typography="t3" 
                fontWeight="bold"
                style={{ marginBottom: '8px' }}
              >
                재판 중인 글
              </Text>
              <Text 
                display="block" 
                color="#191F28" 
                typography="t7" 
                fontWeight="regular"
                style={{ marginBottom: '12px' }}
              >
                재판에 참여해보세요!
              </Text>
              <button
                onClick={() => navigate('/create-post')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#E3F2FD',
                  color: '#1976D2',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                글쓰기
              </button>
            </div>
            <div style={{ marginLeft: '16px' }}>
              <img 
                src={scaleIcon} 
                alt="저울" 
                style={{ 
                  width: '80px', 
                  height: '80px',
                  objectFit: 'contain'
                }} 
              />
            </div>
          </div>
        </div>
      )}

      {/* HOT 게시판 탭일 때만 표시되는 섹션 */}
      {selectedTab === 'HOT 게시판' && (
        <div style={{ 
          padding: '0 20px', 
          marginBottom: '20px',
          background: 'linear-gradient(180deg, #ffeeee 0%, #ffffff 100%)',
          paddingTop: '16px',
          marginTop: '-12px'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <div style={{ flex: 1 }}>
              <Text 
                display="block" 
                color="#191F28ff" 
                typography="t3" 
                fontWeight="bold"
                style={{ marginBottom: '8px' }}
              >
                실시간 HOT한 글
              </Text>
              <Text 
                display="block" 
                color="#191F28" 
                typography="t7" 
                fontWeight="regular"
                style={{ marginBottom: '12px' }}
              >
                재판에 참여해보세요!
              </Text>
            </div>
            <div style={{ marginLeft: '16px' }}>
              <img 
                src={hotFlameIcon} 
                alt="핫게시판" 
                style={{ 
                  width: '80px', 
                  height: '80px',
                  objectFit: 'contain'
                }} 
              />
            </div>
          </div>
        </div>
      )}

      {/* 재판 완료 탭일 때만 표시되는 섹션 */}
      {selectedTab === '재판 완료' && (
        <div style={{ 
          padding: '0 20px', 
          marginBottom: '20px',
          background: 'linear-gradient(180deg, #fff3e0 0%, #ffffff 100%)',
          paddingTop: '16px',
          marginTop: '-12px'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <div style={{ flex: 1 }}>
              <Text 
                display="block" 
                color="#191F28ff" 
                typography="t3" 
                fontWeight="bold"
                style={{ marginBottom: '8px' }}
              >
                재판 완료된 글
              </Text>
              <Text 
                display="block" 
                color="#191F28" 
                typography="t7" 
                fontWeight="regular"
                style={{ marginBottom: '12px' }}
              >
                어떤 경우가 합리적이었을까요?
              </Text>
            </div>
            <div style={{ marginLeft: '16px' }}>
              <img 
                src={gavelIcon} 
                alt="판사봉" 
                style={{ 
                  width: '80px', 
                  height: '80px',
                  objectFit: 'contain'
                }} 
              />
            </div>
          </div>
          
          {/* 검색창 */}
          <div style={{ 
            marginBottom: '16px',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              zIndex: 1
            }}>
              <Asset.Icon
                frameShape={{ width: 20, height: 20 }}
                backgroundColor="transparent"
                name="icon-search-mono"
                color="#9E9E9E"
                aria-hidden={true}
              />
            </div>
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="관심 키워드 검색"
              style={{
                width: '100%',
                padding: '12px 16px 12px 44px',
                border: '1px solid #E5E5E5',
                borderRadius: '8px',
                fontSize: '15px',
                backgroundColor: 'white',
                color: '#191F28',
                boxSizing: 'border-box'
              }}
            />
          </div>
          
          {/* 필터 버튼 */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginBottom: '16px'
          }}>
            {(['전체', '무죄', '유죄', '보류'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setCompletedFilter(filter)}
                style={{
                  padding: '6px 16px',
                  backgroundColor: completedFilter === filter ? '#191F28' : 'transparent',
                  color: completedFilter === filter ? 'white' : '#666',
                  border: 'none',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: completedFilter === filter ? '600' : '400',
                  cursor: 'pointer'
                }}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 게시글 목록 */}
      {selectedTab === '재판 완료' ? (
        <div style={{ padding: '0' }}>
          {isPostsLoading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <Text color="#6B7684">게시물을 불러오는 중...</Text>
            </div>
          ) : error ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <Text color="#D32F2F">{error}</Text>
            </div>
          ) : (
            <CompletedPostList 
              posts={allPosts} 
              navigate={navigate}
              filter={completedFilter}
              searchKeyword={searchKeyword}
            />
          )}
        </div>
      ) : (
        <div style={{ padding: '0 20px', backgroundColor: 'white' }}>
          {isPostsLoading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <Text color="#6B7684">게시물을 불러오는 중...</Text>
            </div>
          ) : error ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <Text color="#D32F2F">{error}</Text>
            </div>
          ) : (
            <PostList 
              posts={allPosts} 
              selectedTab={selectedTab} 
              navigate={navigate}
            />
          )}
        </div>
      )}

      <Spacing size={24} />
    </div>
  );
}

// PostList 컴포넌트를 별도로 분리
interface PostListProps {
  posts: CaseDocument[];
  selectedTab: string;
  navigate: (path: string, state?: any) => void;
}

function PostList({ posts, selectedTab, navigate }: PostListProps) {
  const [postsWithDetails, setPostsWithDetails] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPostDetails = async () => {
      setIsLoading(true);
      try {
        // 각 게시글의 실제 댓글 수를 조회
        const postsWithData = await Promise.all(
          posts.map(async (post) => {
            // 실제 댓글 수 조회 (CaseDetailPage와 동일한 방식)
            let actualCommentCount = 0;
            try {
              const comments = await getComments(post.id);
              const repliesPromises = comments.map(comment => getReplies(post.id, comment.id));
              const repliesArrays = await Promise.all(repliesPromises);
              actualCommentCount = comments.length + repliesArrays.reduce((sum, replies) => sum + replies.length, 0);
            } catch (error) {
              console.error(`게시글 ${post.id}의 댓글 수 조회 실패:`, error);
            }

            // voteCount는 화면 표시에 필요하므로 유지합니다.
            const voteCount = post.guiltyCount + post.innocentCount;
            
            // HOT 점수 계산: 투표수 + 2*댓글수 (실제 조회한 댓글 수 사용)
            const hotScore = voteCount + (2 * actualCommentCount);
            
            // 재판 결과 결정 (innocent가 많으면 무죄, guilty가 많으면 유죄, 동률이면 보류)
            let verdict: '무죄' | '유죄' | '보류' = '보류'; // 기본값을 보류로 설정
            if (voteCount > 0) {
              if (post.innocentCount > post.guiltyCount) {
                verdict = '무죄';
              } else if (post.guiltyCount > post.innocentCount) {
                verdict = '유죄';
              } else {
                verdict = '보류'; // 동률인 경우
              }
            }
            // voteCount === 0인 경우도 보류로 처리

            return {
              ...post,
              commentCount: actualCommentCount, // 실제 조회한 댓글 수로 덮어쓰기
              voteCount,
              hotScore,
              verdict
            };
          })
        );

        setPostsWithDetails(postsWithData);
      } catch (error) {
        console.error('게시물 상세 정보 처리 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPostDetails();
  }, [posts]);

  if (isLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Text color="#6B7684">게시물 정보를 불러오는 중...</Text>
      </div>
    );
  }

  // 탭별 게시물 필터링 및 정렬
  let displayPosts = postsWithDetails;
  
  if (selectedTab === 'HOT 게시판') {
    // 재판 중인 게시물만 필터링하고 HOT 점수로 정렬, 상위 5개만 표시
    // HOT 점수가 0보다 큰 게시물만 표시 (투표나 댓글이 있는 게시물만)
    displayPosts = postsWithDetails
      .filter(post => post.status === 'OPEN' && post.hotScore > 0)
      .sort((a, b) => b.hotScore - a.hotScore)
      .slice(0, 5);
  } else if (selectedTab === '재판 완료') {
    // status가 'CLOSED'인 게시물만 필터링하고 완료일 최신순으로 정렬
    displayPosts = postsWithDetails
      .filter(post => post.status === 'CLOSED')
      .sort((a, b) => {
        const dateA = a.voteEndAt?.toMillis() || 0;
        const dateB = b.voteEndAt?.toMillis() || 0;
        return dateB - dateA;
      });
  } else {
    // 재판 중: status가 'OPEN'인 게시물만 표시
    displayPosts = postsWithDetails.filter(post => post.status === 'OPEN');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
      {displayPosts.map((post, index) => {
        // 재판 완료 탭일 경우 다른 레이아웃
        if (selectedTab === '재판 완료') {
          const formatDate = (timestamp: Timestamp | undefined) => {
            if (!timestamp) return '';
            const date = timestamp.toDate();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}.${month}.${day}`;
          };

          return (
            <div 
              key={post.id}
              onClick={() => navigate(`/case/${post.id}`, { state: { fromTab: selectedTab } })}
              style={{ 
                backgroundColor: 'white', 
                padding: '16px', 
                borderRadius: '8px',
                border: '1px solid #e5e5e5',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              {/* 왼쪽: 무죄/유죄/보류 배지 */}
              <div style={{
                padding: '8px 16px',
                backgroundColor: (post.verdict || '보류') === '무죄' ? '#E3F2FD' : (post.verdict || '보류') === '유죄' ? '#FFEBEE' : '#F2F4F6',
                color: (post.verdict || '보류') === '무죄' ? '#1976D2' : (post.verdict || '보류') === '유죄' ? '#D32F2F' : '#6B7684',
                fontSize: '14px',
                fontWeight: '600',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
                minWidth: 'fit-content'
              }}>
                {post.verdict || '보류'}
              </div>

              {/* 가운데: 날짜와 제목 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* 판결 완료 날짜 */}
                <div style={{ 
                  fontSize: '12px', 
                  color: '#6B7684',
                  marginBottom: '4px'
                }}>
                  {formatDate(post.voteEndAt)}
                </div>
                {/* 제목 */}
                <div style={{ 
                  fontSize: '15px', 
                  color: '#191F28',
                  fontWeight: '500',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {post.title}
                </div>
              </div>

              {/* 오른쪽: 화살표 아이콘 */}
              <Asset.Icon
                frameShape={Asset.frameShape.CleanW20}
                name="icon-arrow-right-mono"
                color="rgba(0, 19, 43, 0.38)"
                aria-label="자세히 보기"
              />
            </div>
          );
        }

        // 재판 중 / HOT 게시판 레이아웃
        return (
          <div 
            key={post.id}
            onClick={() => navigate(`/case/${post.id}`, { state: { fromTab: selectedTab } })}
            style={{ 
              backgroundColor: 'white', 
              padding: '16px', 
              borderTop: index === 0 ? '1px solid #F0F0F0' : 'none',
              borderBottom: '1px solid #F0F0F0',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <Text color="#9E9E9E" typography="t7" fontWeight="regular">
                {post.authorNickname}
              </Text>
              {post.createdAt && (
                <Text color="#9E9E9E" typography="st13" fontWeight="regular">
                  {formatDate(post.createdAt)}
                </Text>
              )}
            </div>
            {/* HOT 게시판일 때만 TOP N 표시 */}
            {selectedTab === 'HOT 게시판' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                <Asset.Icon
                  frameShape={Asset.frameShape.CleanW20}
                  backgroundColor="transparent"
                  name="icon-emoji-fire"
                  aria-hidden={true}
                  ratio="1/1"
                />
                <Text
                  display="block"
                  color="#FF6B6B"
                  typography="t6"
                  fontWeight="bold"
                >
                  TOP {index + 1}
                </Text>
              </div>
            )}
            <Text 
              display="block" 
              color="#191F28" 
              typography="t5" 
              fontWeight="bold"
              style={{ marginBottom: '4px' }}
            >
              {post.title}
            </Text>
            <Text 
              display="block" 
              color="#191F28ff" 
              typography="t7" 
              fontWeight="regular"
              style={{ 
                marginBottom: '8px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}
            >
              {post.content}
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <img 
                  src={commentIcon} 
                  alt="댓글" 
                  style={{ 
                    width: '18px', 
                    height: '18px',
                    objectFit: 'contain',
                    verticalAlign: 'middle',
                    display: 'inline-block',
                    marginTop: '2px'
                  }} 
                />
                <Text color="#3182F6" typography="st13" fontWeight="medium">
                  {post.commentCount ?? 0}
                </Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <img 
                  src={voteIcon} 
                  alt="투표" 
                  style={{ 
                    width: '24px', 
                    height: '24px',
                    objectFit: 'contain',
                    verticalAlign: 'middle',
                    display: 'inline-block'
                  }} 
                />
                <Text color="#3182F6" typography="st13" fontWeight="medium">
                  {(post.guiltyCount || 0) + (post.innocentCount || 0)}
                </Text>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 재판 완료 전용 컴포넌트
interface CompletedPostListProps {
  posts: CaseDocument[];
  navigate: (path: string, state?: any) => void;
  filter: '전체' | '무죄' | '유죄' | '보류';
  searchKeyword: string;
}

function CompletedPostList({ posts, navigate, filter, searchKeyword }: CompletedPostListProps) {
  const [postsWithDetails, setPostsWithDetails] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPostDetails = () => {
      setIsLoading(true);
      try {
        // getAllCases로 가져온 post.commentCount를 직접 사용 (N+1 문제 해결)
        const postsWithData = posts.map((post) => {
          const voteCount = post.guiltyCount + post.innocentCount;
          // HOT 점수 계산: 투표수 + 2*댓글수 (post.commentCount 직접 사용)
          const hotScore = voteCount + (2 * (post.commentCount || 0));
          // 재판 결과 결정 (innocent가 많으면 무죄, guilty가 많으면 유죄, 동률이면 보류)
          let verdict: '무죄' | '유죄' | '보류' = '보류'; // 기본값을 보류로 설정
          if (voteCount > 0) {
            if (post.innocentCount > post.guiltyCount) {
              verdict = '무죄';
            } else if (post.guiltyCount > post.innocentCount) {
              verdict = '유죄';
            } else {
              verdict = '보류'; // 동률인 경우
            }
          }
          // voteCount === 0인 경우도 보류로 처리

          return {
            ...post, // DB에 저장된 status, commentCount가 여기에 포함됩니다.
            voteCount,
            hotScore,
            verdict
          };
        });

        setPostsWithDetails(postsWithData);
      } catch (error) {
        console.error('게시물 상세 정보 로드 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPostDetails();
  }, [posts]);

  if (isLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Text color="#6B7684">게시물 정보를 불러오는 중...</Text>
      </div>
    );
  }

  const formatDate = (timestamp: Timestamp | undefined) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 재판 완료된 전체 게시물 (필터 및 검색 적용)
  const allCompletedPosts = postsWithDetails
    .filter(post => post.status === 'CLOSED')
    .filter(post => {
      // 검색어 필터 (제목 또는 본문에 포함)
      if (searchKeyword.trim()) {
        const keyword = searchKeyword.trim().toLowerCase();
        const titleMatch = post.title.toLowerCase().includes(keyword);
        const contentMatch = post.content.toLowerCase().includes(keyword);
        if (!titleMatch && !contentMatch) {
          return false;
        }
      }
      
      // verdict 필터
      if (filter === '전체') return true;
      // verdict가 정확히 일치하는 경우만 필터링
      // 엄격한 비교 - post.verdict를 직접 비교
      if (filter === '무죄') {
        return post.verdict === '무죄';
      }
      if (filter === '유죄') {
        return post.verdict === '유죄';
      }
      if (filter === '보류') {
        // 보류는 verdict가 '보류'이거나 null/undefined인 경우
        return post.verdict === '보류' || !post.verdict;
      }
      return true;
    })
    .sort((a, b) => {
      const dateA = a.voteEndAt?.toMillis() || 0;
      const dateB = b.voteEndAt?.toMillis() || 0;
      return dateB - dateA;
    });

  // HOT 게시판에 있던 상태로 재판이 완료된 글들 (HOT 점수 기준)
  const hotCompletedPosts = postsWithDetails
    .filter(post => post.status === 'CLOSED' && post.hotScore > 0)
    .sort((a, b) => b.hotScore - a.hotScore);

  const renderPostCard = (post: any) => (
    <div
      key={post.id}
      onClick={() => navigate(`/case/${post.id}`, { state: { fromTab: '재판 완료' } })}
      style={{
        backgroundColor: '#f2f4f6',
        borderRadius: '10px',
        padding: '16px',
        minWidth: '172px',
        width: '172px',
        height: '211px',
        marginRight: '12px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxSizing: 'border-box'
      }}
    >
      {/* 배지 */}
      <div style={{
        padding: '4px 8px',
        backgroundColor: (post.verdict || '보류') === '무죄' ? '#3182F628' : (post.verdict || '보류') === '유죄' ? '#F0445228' : '#4E596828',
        color: (post.verdict || '보류') === '무죄' ? '#1976D2' : (post.verdict || '보류') === '유죄' ? '#D32F2F' : '#6B7684',
        fontSize: '12px',
        fontWeight: '600',
        borderRadius: '4px',
        width: 'fit-content'
      }}>
        {post.verdict || '보류'}
      </div>

      {/* 제목 */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 0
      }}>
        <Text
          display="block"
          color="#191F28"
          typography="t3"
          fontWeight="bold"
          style={{
            textAlign: 'center',
            wordBreak: 'break-word',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            lineHeight: '1.4'
          }}
        >
          {post.title}
        </Text>
      </div>

      {/* 날짜 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 'auto'
      }}>
        <Text
          display="block"
          color="#6B7684"
          typography="t7"
          fontWeight="regular"
        >
          {formatDate(post.voteEndAt)}
        </Text>
        <Asset.Icon
          frameShape={Asset.frameShape.CleanW24}
          backgroundColor="transparent"
          name="icon-system-arrow-right-outlined"
          color="rgba(0, 19, 43, 0.38)"
          aria-hidden={true}
        />
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', backgroundColor: 'white' }}>
      {/* 위쪽: 재판 완료된 전체 게시물 */}
      <div>
        <div style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: '0 20px',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          cursor: 'grab'
        }}
        onWheel={(e) => {
          const container = e.currentTarget;
          container.scrollLeft += e.deltaY;
          e.preventDefault();
        }}
        >
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '0',
            paddingRight: '20px'
          }}>
            {allCompletedPosts.map(renderPostCard)}
          </div>
        </div>
        <style>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </div>

      {/* 아래쪽: 화제의 재판 기록 */}
      {hotCompletedPosts.length > 0 && (
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0 20px',
            marginBottom: '16px'
          }}>
            <img
              src={hotFlameIcon}
              alt="화제"
              style={{
                width: '24px',
                height: '24px',
                objectFit: 'contain'
              }}
            />
            <Text
              display="block"
              color="#191F28"
              typography="t4"
              fontWeight="bold"
            >
              화제의 재판 기록
            </Text>
          </div>
          <div style={{
            overflowX: 'auto',
            overflowY: 'hidden',
            padding: '0 20px',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            cursor: 'grab'
          }}
          onWheel={(e) => {
            const container = e.currentTarget;
            container.scrollLeft += e.deltaY;
            e.preventDefault();
          }}
          >
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              gap: '0',
              paddingRight: '20px'
            }}>
              {hotCompletedPosts.map(renderPostCard)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;
