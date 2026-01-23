import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Asset, Text, Spacing, Button } from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { useAuth } from '../hooks/useAuth';
import { getCase, updateCase } from '../api/cases';

function EditPostPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: isAuthLoading, login } = useAuth();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPostLoading, setIsPostLoading] = useState(true);
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
            navigate(`/case/${id}`);
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
  }, [id, user, isAuthLoading, navigate, location]);

  const handleSubmit = async () => {
    if (!id || !user) {
      alert('로그인이 필요합니다.');
      login();
      return;
    }

    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }

    try {
      await updateCase(id, { title: title.trim(), content: content.trim() });
      alert('게시물이 수정되었습니다!');
      navigate(`/case/${id}`);
    } catch (error) {
      console.error('게시물 수정 실패:', error);
      alert('게시물 수정에 실패했습니다.');
    }
  };
  
  if (isPostLoading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <Text color="#191F28">로딩 중...</Text>
      </div>
    );
  }

  if (error) {
     return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <Text color="#D32F2F" style={{ marginBottom: '20px' }}>{error}</Text>
        <Button onClick={() => navigate('/')} size="medium">
          홈으로 돌아가기
        </Button>
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
      {/* Header */}
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
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (id) {
              navigate(`/case/${id}`);
            } else {
              navigate('/');
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            zIndex: 10
          }}
        >
          <Asset.Icon
            frameShape={Asset.frameShape.CleanW24}
            backgroundColor="transparent"
            name="icon-arrow-back-ios-mono"
            color="#191F28"
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
          style={{ marginBottom: '24px' }}
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

        <Spacing size={20} />

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
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px 20px',
        backgroundColor: 'white',
        borderTop: '1px solid #e5e5e5',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ width: '100%' }}>
          <Button
            onClick={handleSubmit}
            size="large"
            style={{ width: '100%' }}
          >
            수정 완료
          </Button>
        </div>
      </div>
    </div>
  );
}

export default EditPostPage;
