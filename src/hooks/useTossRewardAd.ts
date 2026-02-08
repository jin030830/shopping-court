import { useCallback, useEffect, useState } from 'react';
import { GoogleAdMob } from '@apps-in-toss/web-framework';

// 전역 상태 관리를 위한 모듈 레벨 변수 (Singleton)
let globalIsLoaded = false;
let globalIsLoading = false;
let globalRetryCount = 0;
const MAX_RETRY = 5;

export const useTossRewardAd = (adUnitId: string) => {
  const [, setTick] = useState(0); // 로컬 상태 강제 리렌더링용
  const forceUpdate = useCallback(() => setTick(t => t + 1), []);

  const load = useCallback(() => {
    if (!GoogleAdMob?.loadAppsInTossAdMob?.isSupported?.()) {
      console.warn('[AdMob] 광고 로드 미지원 환경');
      return;
    }

    if (globalIsLoading || globalIsLoaded) return;

    try {
      console.log(`[AdMob] 광고 선제 로드 시작: ${adUnitId}`);
      globalIsLoading = true;
      forceUpdate();

      const cleanup = GoogleAdMob.loadAppsInTossAdMob({
        options: { adGroupId: adUnitId },
        onEvent: (event) => {
          console.log(`[AdMob] Load Event: ${event.type}`);
          if (event.type === 'loaded') {
            globalIsLoaded = true;
            globalIsLoading = false;
            globalRetryCount = 0;
            forceUpdate();
            if (cleanup) cleanup();
          }
        },
        onError: (error) => {
          console.error('[AdMob] 광고 로드 실패:', error);
          globalIsLoaded = false;
          globalIsLoading = false;
          forceUpdate();

          if (globalRetryCount < MAX_RETRY) {
            const delay = Math.pow(2, globalRetryCount) * 1000;
            setTimeout(() => {
              globalRetryCount += 1;
              load();
            }, delay);
          }
        },
      });
    } catch (e) {
      console.error('[AdMob] load 예외:', e);
      globalIsLoading = false;
      forceUpdate();
    }
  }, [adUnitId, forceUpdate]);

  const show = useCallback((onRewardEarned: () => void, onDismiss?: () => void) => {
    if (!GoogleAdMob?.showAppsInTossAdMob?.isSupported?.()) return;

    if (!globalIsLoaded) {
      console.warn('[AdMob] 광고 미준수 상태에서 노출 시도');
      alert('광고를 불러오는 중이에요. 잠시 후 다시 시도해 주세요.');
      load();
      return;
    }

    try {
      console.log(`[AdMob] 광고 노출 시도: ${adUnitId}`);
      
      const cleanupShow = GoogleAdMob.showAppsInTossAdMob({
        options: { adGroupId: adUnitId },
        onEvent: (event) => {
          console.log(`[AdMob] Show Event: ${event.type}`, event.data);
          
          if (event.type === 'userEarnedReward') {
            onRewardEarned();
          }

          if (event.type === 'dismissed') {
            globalIsLoaded = false;
            forceUpdate();
            if (cleanupShow) cleanupShow();
            if (onDismiss) onDismiss();
            // [Zero-Wait] 광고 닫히자마자 다음 광고 즉시 충전
            setTimeout(() => load(), 100);
          }
        },
        onError: (error) => {
          console.error('[AdMob] 광고 표시 에러:', error);
          globalIsLoaded = false;
          forceUpdate();
          if (cleanupShow) cleanupShow();
          if (onDismiss) onDismiss();
          load();
        },
      });
    } catch (e) {
      console.error('[AdMob] show 예외:', e);
      if (onDismiss) onDismiss();
    }
  }, [adUnitId, load, forceUpdate]);

  useEffect(() => {
    load();
  }, [load]);

  return { isLoaded: globalIsLoaded, isLoading: globalIsLoading, show, load };
};
