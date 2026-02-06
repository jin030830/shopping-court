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
    // 가이드 준수: 광고가 로드되지 않았으면 실행하지 않음
    if (!isLoaded) {
      console.warn('[AdMob-Reward] 광고가 아직 로드되지 않았습니다.');
      alert('광고를 준비 중입니다. 잠시 후 다시 시도해 주세요.');
      if (onDismiss) onDismiss();
      return;
    }

    try {
      console.log(`[AdMob-Reward] 광고 노출 시도 (adGroupId): ${adUnitId}`);
      const cleanupShow = GoogleAdMob.showAppsInTossAdMob({
        options: { adGroupId: adUnitId } as any,
        onEvent: (event: { type: string; data?: any }) => {
          console.log(`[AdMob-Reward] Show Event: ${event.type}`, event.data);
          
          // 공식 가이드: 오직 userEarnedReward 시점에만 보상 지급
          if (event.type === 'userEarnedReward') {
            console.log('[AdMob-Reward] 보상 획득 조건 달성');
            onRewardEarned();
          }

          if (event.type === 'closed' || event.type === 'dismissed') {
            console.log('[AdMob-Reward] 광고 닫힘');
            if (onDismiss) onDismiss();
            setIsLoaded(false);
            if (cleanupShow) cleanupShow();
            load(); // 다음 광고 미리 로드
          }
        },
        onError: (error: unknown) => {
          console.error('[AdMob-Reward] 광고 표시 실패:', error);
          // 실패 시 보상 지급 절대 안 함 (가이드 준수)
          if (onDismiss) onDismiss();
          setIsLoaded(false);
          if (cleanupShow) cleanupShow();
          load();
        },
      });
    } catch (e) {
      console.error('[AdMob-Reward] showAppsInTossAdMob 예외 발생:', e);
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