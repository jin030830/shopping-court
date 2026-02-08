import { useCallback, useEffect, useState, useRef } from 'react';
import { GoogleAdMob } from '@apps-in-toss/web-framework';

export const useTossRewardAd = (adUnitId: string) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const loadCleanupRef = useRef<(() => void) | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRY = 5;

  const load = useCallback(() => {
    // 1. 지원 여부 확인
    if (!GoogleAdMob?.loadAppsInTossAdMob?.isSupported?.()) {
      console.warn('[AdMob] 광고 로드를 지원하지 않는 환경입니다.');
      return;
    }

    // 이미 로딩 중이거나 로드 완료된 경우 중복 호출 방지
    if (isLoading || isLoaded) return;

    try {
      console.log(`[AdMob] 광고 로드 시도: ${adUnitId}`);
      setIsLoading(true);

      const cleanup = GoogleAdMob.loadAppsInTossAdMob({
        options: { adGroupId: adUnitId },
        onEvent: (event) => {
          console.log(`[AdMob] Load Event: ${event.type}`);
          if (event.type === 'loaded') {
            setIsLoaded(true);
            setIsLoading(false);
            retryCountRef.current = 0; // 성공 시 재시도 횟수 초기화
            
            // 2. 가이드 준수: 로드 완료 시 즉시 cleanup 호출하여 리소스 정리
            if (cleanup) cleanup();
          }
        },
        onError: (error) => {
          console.error('[AdMob] 광고 로드 실패:', error);
          setIsLoaded(false);
          setIsLoading(false);

          // 3. 자동 재시도 로직 (Exponential Backoff)
          if (retryCountRef.current < MAX_RETRY) {
            const delay = Math.pow(2, retryCountRef.current) * 1000;
            console.log(`[AdMob] ${delay}ms 후 재시도 합니다. (횟수: ${retryCountRef.current + 1})`);
            setTimeout(() => {
              retryCountRef.current += 1;
              load();
            }, delay);
          }
        },
      });

      loadCleanupRef.current = cleanup;
    } catch (e) {
      console.error('[AdMob] loadAppsInTossAdMob 예외 발생:', e);
      setIsLoading(false);
    }
  }, [adUnitId, isLoaded, isLoading]);

  const show = useCallback((onRewardEarned: () => void, onDismiss?: () => void) => {
    // 1. 지원 여부 확인
    if (!GoogleAdMob?.showAppsInTossAdMob?.isSupported?.()) {
      console.warn('[AdMob] 광고 노출을 지원하지 않는 환경입니다.');
      return;
    }

    // 로드되지 않은 경우 얼럿 표시 및 즉시 재로드 시도
    if (!isLoaded) {
      console.warn('[AdMob] 광고가 로드되지 않은 상태에서 show 호출');
      alert('광고를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
      load();
      if (onDismiss) onDismiss();
      return;
    }

    try {
      console.log(`[AdMob] 광고 노출 시도: ${adUnitId}`);
      
      const cleanupShow = GoogleAdMob.showAppsInTossAdMob({
        options: { adGroupId: adUnitId },
        onEvent: (event) => {
          console.log(`[AdMob] Show Event: ${event.type}`, event.data);
          
          // 가이드 준수: userEarnedReward 시점에만 보상 지급
          if (event.type === 'userEarnedReward') {
            console.log('[AdMob] 보상 조건 충족');
            onRewardEarned();
          }

          // 광고 종료 시 상태 초기화 및 다음 광고 예약 로드
          if (event.type === 'dismissed') {
            setIsLoaded(false);
            if (cleanupShow) cleanupShow();
            if (onDismiss) onDismiss();
            // 0.5초 뒤 다음 광고 미리 로드
            setTimeout(() => load(), 500);
          }
        },
        onError: (error) => {
          console.error('[AdMob] 광고 표시 에러:', error);
          setIsLoaded(false);
          if (cleanupShow) cleanupShow();
          if (onDismiss) onDismiss();
          load();
        },
      });
    } catch (e) {
      console.error('[AdMob] showAppsInTossAdMob 예외 발생:', e);
      if (onDismiss) onDismiss();
    }
  }, [adUnitId, isLoaded, load]);

  useEffect(() => {
    // 최초 진입 시 로드
    load();
    return () => {
      if (loadCleanupRef.current) loadCleanupRef.current();
    };
  }, [load]);

  return { isLoaded, show };
};
