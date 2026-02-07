import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * 페이지 이동 시 스크롤 위치를 복원하는 컴포넌트입니다.
 * useLayoutEffect를 사용하여 Paint 이전에 스크롤을 복원함으로써 깜빡임을 방지합니다.
 */
const ScrollRestoration = () => {
  const { pathname, key } = useLocation();
  const navigationType = useNavigationType();
  const scrollPositions = useRef<Record<string, number>>({});

  // 브라우저의 기본 스크롤 복원 비활성화
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  // 스크롤 위치 저장 (이건 화면에 영향이 없으므로 useEffect 유지)
  useEffect(() => {
    const handleScroll = () => {
      scrollPositions.current[key] = window.scrollY;
      try {
        sessionStorage.setItem(`scroll-pos-${key}`, window.scrollY.toString());
      } catch (e) { /* ignore */ }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [key]);

  // 스크롤 위치 복원 (화면 그리기 직전에 실행)
  useLayoutEffect(() => {
    if (navigationType === 'POP') {
      const savedPos = scrollPositions.current[key] || 
                       parseInt(sessionStorage.getItem(`scroll-pos-${key}`) || '0', 10);
      
      if (savedPos > 0) {
        // 즉시 동기적으로 스크롤 (화면 그리기 전)
        window.scrollTo(0, savedPos);

        // 비동기 데이터 로딩으로 인해 높이가 변할 것을 대비한 보조 복원
        const timer = setTimeout(() => {
          window.scrollTo(0, savedPos);
        }, 0);
        
        const timer2 = setTimeout(() => {
          window.scrollTo(0, savedPos);
        }, 50);

        return () => {
          clearTimeout(timer);
          clearTimeout(timer2);
        };
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [key, navigationType, pathname]);

  return null;
};

export default ScrollRestoration;
