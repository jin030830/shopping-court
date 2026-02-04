import { useCallback, useEffect, useState, useRef } from 'react';
import { GoogleAdMob } from '@apps-in-toss/web-framework';

export const useTossAd = (adUnitId: string) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const cleanupLoadRef = useRef<(() => void) | null>(null);

  const load = useCallback(() => {
    try {
      console.log(`[AdMob] 광고 로드 시도 (adGroupId): ${adUnitId}`);
      
      // 기존 로드 프로세스 정리
      if (cleanupLoadRef.current) {
        cleanupLoadRef.current();
      }

      const cleanup = GoogleAdMob.loadAppsInTossAdMob({
        options: { adGroupId: adUnitId } as any,
        onEvent: (event: { type: string }) => {
          console.log(`[AdMob] Load Event: ${event.type}`);
          if (event.type === 'loaded') {
            setIsLoaded(true);
          }
        },
        onError: (error: unknown) => {
          console.error('[AdMob] 광고 로드 실패:', error);
          setIsLoaded(false);
        },
      });

      cleanupLoadRef.current = cleanup;
    } catch (e) {
      console.error('[AdMob] loadAppsInTossAdMob 호출 실패:', e);
    }
  }, [adUnitId]);

  const show = useCallback((onDismiss: () => void) => {
    if (!isLoaded) {
      onDismiss();
      return;
    }

    try {
      const cleanupShow = GoogleAdMob.showAppsInTossAdMob({
        options: { adGroupId: adUnitId } as any,
        onEvent: (event: { type: string }) => {
          if (event.type === 'closed' || event.type === 'dismissed') {
            onDismiss();
            setIsLoaded(false);
            if (cleanupShow) cleanupShow();
            load(); 
          }
        },
        onError: () => {
          onDismiss(); 
          setIsLoaded(false);
          if (cleanupShow) cleanupShow();
          load();
        },
      });
    } catch (e) {
      console.error('[AdMob] showAppsInTossAdMob 호출 실패:', e);
      onDismiss();
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
