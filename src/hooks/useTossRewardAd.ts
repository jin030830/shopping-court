import { useCallback, useEffect, useState, useRef } from 'react';
import { GoogleAdMob } from '@apps-in-toss/web-framework';

export const useTossRewardAd = (adUnitId: string) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const cleanupLoadRef = useRef<(() => void) | null>(null);

  const load = useCallback(() => {
    try {
      console.log(`[AdMob-Reward] 광고 로드 시도 (adGroupId): ${adUnitId}`);
      
      if (cleanupLoadRef.current) {
        cleanupLoadRef.current();
      }

      const cleanup = GoogleAdMob.loadAppsInTossAdMob({
        options: { adGroupId: adUnitId } as any,
        onEvent: (event: { type: string }) => {
          console.log(`[AdMob-Reward] Load Event: ${event.type}`);
          if (event.type === 'loaded') {
            setIsLoaded(true);
          }
        },
        onError: (error: unknown) => {
          console.error('[AdMob-Reward] 광고 로드 실패:', error);
          setIsLoaded(false);
        },
      });

      cleanupLoadRef.current = cleanup;
    } catch (e) {
      console.error('[AdMob-Reward] loadAppsInTossAdMob 호출 실패:', e);
    }
  }, [adUnitId]);

  const show = useCallback((onRewardEarned: () => void, onDismiss?: () => void) => {
    if (!isLoaded) {
      console.warn('[AdMob-Reward] 광고가 아직 로드되지 않았습니다.');
      // 광고 실패 시 보상 지급 여부는 정책에 따라 결정
      onRewardEarned();
      if (onDismiss) onDismiss();
      return;
    }

    try {
      const cleanupShow = GoogleAdMob.showAppsInTossAdMob({
        options: { adGroupId: adUnitId } as any,
        onEvent: (event: { type: string; data?: any }) => {
          if (event.type === 'userEarnedReward') {
            onRewardEarned();
          }

          if (event.type === 'closed' || event.type === 'dismissed') {
            if (onDismiss) onDismiss();
            setIsLoaded(false);
            if (cleanupShow) cleanupShow();
            load(); 
          }
        },
        onError: () => {
          if (onDismiss) onDismiss();
          setIsLoaded(false);
          if (cleanupShow) cleanupShow();
          load();
        },
      });
    } catch (e) {
      if (onDismiss) onDismiss();
    }
  }, [adUnitId, isLoaded, load]);

  useEffect(() => {
    const isSupported = GoogleAdMob?.loadAppsInTossAdMob?.isSupported?.() ?? true;
    if (isSupported) {
      load();
    }

    return () => {
      if (cleanupLoadRef.current) cleanupLoadRef.current();
    };
  }, [load]);

  return { isLoaded, show };
};
