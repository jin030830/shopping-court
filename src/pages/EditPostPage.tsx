import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Asset, Text } from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { useAuth } from '../hooks/useAuth';

function EditPostPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userData, isLoading } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  // 게시물 불러오기
  useEffect(() => {
    if (id) {
      try {
        const userPostsStr = localStorage.getItem('user_posts');
        if (userPostsStr) {
          const userPosts = JSON.parse(userPostsStr);
          const post = userPosts.find((p: any) => p.id === id);
          if (post) {
            // 권한 확인
            if (user?.uid !== post.authorId) {
              alert('수정 권한이 없습니다.');
              navigate('/');
              return;
            }
            setTitle(post.title);
            setContent(post.content);
          } else {
            alert('게시물을 찾을 수 없습니다.');
            navigate('/');
          }
        }
      } catch (error) {
        console.error('게시물 로드 실패:', error);
        alert('게시물을 불러올 수 없습니다.');
        navigate('/');
      }
    }
  }, [id, user, navigate]);

  // 로그인 체크
  useEffect(() => {
    if (!isLoading && (!user || !userData)) {
      alert('로그인이 필요합니다.');
      navigate('/terms', { state: { from: location } });
    }
  }, [isLoading, user, userData, navigate, location]);

  const handleSubmit = () => {
    if (!user || !userData) {
      alert('로그인이 필요합니다.');
      navigate('/terms', { state: { from: location } });
      return;
    }

    if (!title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }

    if (!content.trim()) {
      alert('내용을 입력해주세요.');
      return;
    }

    // localStorage에서 게시물 업데이트
    try {
      const userPostsStr = localStorage.getItem('user_posts');
      if (userPostsStr) {
        const userPosts = JSON.parse(userPostsStr);
        const updatedPosts = userPosts.map((p: any) =>
          p.id === id
            ? { ...p, title: title.trim(), content: content.trim() }
            : p
        );
        localStorage.setItem('user_posts', JSON.stringify(updatedPosts));

        alert('게시물이 수정되었습니다!');
        navigate(`/case/${id}`);
      }
    } catch (error) {
      console.error('게시물 수정 실패:', error);
      alert('게시물 수정에 실패했습니다.');
    }
  };

  return (
    <div style={{ 
      backgroundColor: 'white', 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* 헤더 */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: '1px solid #e5e5e5',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <button
          onClick={() => navigate(`/case/${id}`)}
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
            frameShape={Asset.frameShape.CleanW24}
            backgroundColor="transparent"
            name="icon-arrow-back-ios-mono"
            color={adaptive.grey900}
            aria-label="뒤로가기"
          />
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Asset.Image
            frameShape={Asset.frameShape.CleanW16}
            backgroundColor="transparent"
            src="https://static.toss.im/appsintoss/15155/4dfa3fe7-556e-424d-820a-61a865a49168.png"
            aria-hidden={true}
            style={{ width: '24px', height: '24px' }}
          />
          <Text color={adaptive.grey900} typography="t6" fontWeight="semibold">
            소비 재판소
          </Text>
        </div>

        <div style={{ width: '32px' }} />
      </div>

      {/* 컨텐츠 영역 - 스크롤 가능 */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto',
        padding: '20px 20px 100px 20px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <Text 
          display="block" 
          color="#191F28ff" 
          typography="t4" 
          fontWeight="bold"
          style={{ marginBottom: '24px' }}
        >
          게시물 수정하기
        </Text>

        {/* 제목 입력 */}
        <div style={{ marginBottom: '20px' }}>
          <Text 
            display="block" 
            color="#191F28ff" 
            typography="t7" 
            fontWeight="semibold"
            style={{ marginBottom: '8px' }}
          >
            제목
          </Text>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 적어주세요"
            maxLength={100}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              fontSize: '15px',
              boxSizing: 'border-box',
              outline: 'none',
              fontFamily: 'inherit'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#3182F6';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e5e5e5';
            }}
          />
        </div>

        {/* 내용 입력 */}
        <div style={{ marginBottom: '20px' }}>
          <Text 
            display="block" 
            color="#191F28ff" 
            typography="t7" 
            fontWeight="semibold"
            style={{ marginBottom: '8px' }}
          >
            내용
          </Text>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="고민을 얘기해보세요"
            style={{
              width: '100%',
              height: '250px',
              padding: '12px 16px',
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              fontSize: '15px',
              boxSizing: 'border-box',
              outline: 'none',
              resize: 'none',
              fontFamily: 'inherit',
              lineHeight: '1.5'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#3182F6';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e5e5e5';
            }}
          />
        </div>
      </div>

      {/* 하단 고정 버튼 */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px 20px',
        backgroundColor: 'white',
        borderTop: '1px solid #e5e5e5',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <button
          onClick={handleSubmit}
          style={{
            width: '100%',
            padding: '16px',
            backgroundColor: '#3182F6',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          수정 완료
        </button>
      </div>
    </div>
  );
}

export default EditPostPage;
