import { useCallback, useEffect, useState } from 'react';
import { GoogleAdMob } from '@apps-in-toss/web-framework';

export const useTossAd = (adUnitId: string) => {
  const [isLoaded, setIsLoaded] = useState(false);

  const load = useCallback(() => {
    try {
      console.log(`[AdMob] 광고 로드 시도 (adGroupId): ${adUnitId}`);
      GoogleAdMob.loadAppsInTossAdMob({
        options: { adGroupId: adUnitId } as any,
        onEvent: (event: { type: string }) => {
          console.log(`[AdMob] Load Event: ${event.type}`);
          if (event.type === 'loaded') {
            console.log('[AdMob] 광고 로드 완료 (onAdLoaded)');
            setIsLoaded(true);
          }
        },
        onError: (error: unknown) => {
          console.error('[AdMob] 광고 로드 실패 (onAdFailedToLoad):', error);
          setIsLoaded(false);
        },
      });
    } catch (e) {
      console.error('[AdMob] loadAppsInTossAdMob 호출 실패:', e);
    }
  }, [adUnitId]);

  const show = useCallback((onDismiss: () => void) => {
    if (!isLoaded) {
      console.warn('[AdMob] 광고가 아직 로드되지 않았습니다. 즉시 콜백을 실행합니다.');
      onDismiss();
      return;
    }

    try {
      console.log(`[AdMob] 광고 노출 시도 (adGroupId): ${adUnitId}`);
      GoogleAdMob.showAppsInTossAdMob({
        options: { adGroupId: adUnitId } as any, // show에서도 adGroupId 사용 시도
        onEvent: (event: { type: string }) => {
          console.log(`[AdMob] Show Event: ${event.type}`);
          if (
            event.type === 'dismissed' || 
            event.type === 'closed' || 
            event.type === 'onAdDismissedFullScreenContent'
          ) {
            console.log('[AdMob] 광고 닫힘 (onAdDismissedFullScreenContent)');
            onDismiss();
            setIsLoaded(false);
            load(); 
          }
        },
        onError: (error: unknown) => {
          console.error('[AdMob] 광고 노출 실패 (onAdFailedToShowFullScreenContent):', error);
          onDismiss(); 
          setIsLoaded(false);
          load();
        },
      });
    } catch (e) {
      console.error('[AdMob] showAppsInTossAdMob 호출 실패:', e);
      onDismiss();
    }
  }, [adUnitId, isLoaded, load]);

  useEffect(() => {
    if (typeof GoogleAdMob?.loadAppsInTossAdMob?.isSupported === 'function') {
      if (GoogleAdMob.loadAppsInTossAdMob.isSupported()) {
        load();
      } else {
        console.warn('[AdMob] 현재 환경에서 AdMob을 지원하지 않습니다.');
      }
    } else {
      load();
    }
  }, [load]);

  return { isLoaded, show };
};
