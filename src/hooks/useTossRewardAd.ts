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
    // 광고가 로드되지 않았어도 표시 시도
    if (!isLoaded) {
      console.warn('[AdMob-Reward] 광고가 아직 로드되지 않았습니다. 광고를 로드한 후 표시합니다.');
      // 광고를 먼저 로드
      load();
    }

    // 광고가 로드되지 않았어도 표시 시도 (광고가 로드되면 자동으로 표시됨)
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
        onError: (error: unknown) => {
          console.error('[AdMob-Reward] 광고 표시 실패:', error);
          // 광고 표시 실패 시에도 보상 지급 (정책에 따라)
          onRewardEarned();
          if (onDismiss) onDismiss();
          setIsLoaded(false);
          if (cleanupShow) cleanupShow();
          load();
        },
      });
    } catch (e) {
      console.error('[AdMob-Reward] showAppsInTossAdMob 호출 실패:', e);
      // 예외 발생 시에도 보상 지급 (정책에 따라)
      onRewardEarned();
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
