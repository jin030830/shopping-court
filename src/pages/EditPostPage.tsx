import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Text } from '@toss/tds-mobile';
import { useAuth } from '../hooks/useAuth';
import { getCase, updateCase } from '../api/cases';

function EditPostPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading, login } = useAuth();

  // 뒤로가기 핸들러
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/', { replace: true });
    }
  };
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPostLoading, setIsPostLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false); // 중복 제출 방지 상태
  const [error, setError] = useState<string | null>(null);

  // Fetch post data from Firestore
  useEffect(() => {
    if (!id) {
      setError('잘못된 접근입니다.');
      setIsPostLoading(false);
      return;
    }
    
    // Wait for authentication to complete before fetching
    if (isAuthLoading) {
      return;
    }

    if (!user) {
      alert('로그인이 필요합니다.');
      login();
      return;
    }

    const fetchCase = async () => {
      try {
        const postData = await getCase(id);
        if (postData) {
          // Check for authorization
          if (user.uid !== postData.authorId) {
            alert('수정 권한이 없습니다.');
            navigate('/');
            return;
          }
          setTitle(postData.title);
          setContent(postData.content);
        } else {
          setError('게시물을 찾을 수 없습니다.');
        }
      } catch (err) {
        setError('게시물을 불러오는 중 오류가 발생했습니다.');
        console.error(err);
      } finally {
        setIsPostLoading(false);
      }
    };

    fetchCase();
  }, [id, user, isAuthLoading, navigate, login]);

  // 브라우저/토스 앱의 뒤로가기 버튼 처리 - 홈으로 이동
  // (브라우저 기본 뒤로가기 동작을 따르도록 변경)

  const handleSubmit = async () => {
    if (isSubmitting) return; // 중복 클릭 방지

    if (!id || !user) {
      alert('로그인이 필요합니다.');
      login();
      return;
    }

    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }

    setIsSubmitting(true); // 제출 시작

    try {
      await updateCase(id, { title: title.trim(), content: content.trim() });
      alert('게시물이 수정되었습니다!');
      navigate(`/case/${id}`, { replace: true });
    } catch (error) {
      console.error('게시물 수정 실패:', error);
      alert('게시물 수정에 실패했습니다.');
      setIsSubmitting(false); // 실패 시에만 해제 (성공 시 이동하므로 불필요)
    }
  };
  
  if (isPostLoading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ color: '#191F28', fontSize: '15px' }}>로딩 중...</div>
      </div>
    );
  }

  if (error) {
     return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ color: '#D32F2F', marginBottom: '20px', fontSize: '15px' }}>{error}</div>
        <button 
          onClick={handleBack} 
          style={{
            padding: '12px 24px',
            backgroundColor: '#3182F6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          돌아가기
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      backgroundColor: 'white', 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* Content Area */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto',
        padding: '20px 20px 100px 20px',
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: 'white'
      }}>
        <Text 
          display="block" 
          color="#191F28ff" 
          typography="t4" 
          fontWeight="bold"
          style={{ marginBottom: '24px', fontSize: '20px' }}
        >
          게시물 수정하기
        </Text>

        {/* Title Input */}
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
              border: '1px solid #E5E5E5',
              borderRadius: '8px',
              fontSize: '15px',
              boxSizing: 'border-box',
              outline: 'none',
              fontFamily: 'inherit',
              backgroundColor: 'white',
              color: '#191F28'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#3182F6';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#E5E5E5';
            }}
          />
        </div>

        <div style={{ height: '20px' }} />

        {/* Content Input */}
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
              minHeight: '250px',
              padding: '12px 16px',
              border: '1px solid #E5E5E5',
              borderRadius: '8px',
              fontSize: '15px',
              boxSizing: 'border-box',
              outline: 'none',
              resize: 'none',
              fontFamily: 'inherit',
              lineHeight: '1.5',
              backgroundColor: 'white',
              color: '#191F28'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#3182F6';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#E5E5E5';
            }}
          />
        </div>
      </div>

      {/* Fixed Bottom Button */}
      <div style={{
        position: 'fixed',
        bottom: '18px',
        left: 0,
        right: 0,
        padding: '16px 20px',
        backgroundColor: 'white',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: '16px',
            backgroundColor: isSubmitting ? '#E5E8EB' : '#3182F6',
            color: isSubmitting ? '#B0B8C1' : 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: isSubmitting ? 'not-allowed' : 'pointer'
          }}
        >
          {isSubmitting ? '수정 중...' : '수정 완료'}
        </button>
      </div>
    </div>
  );
}

export default EditPostPage;
