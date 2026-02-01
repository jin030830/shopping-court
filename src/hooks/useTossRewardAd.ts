import { useCallback, useEffect, useState } from 'react';
import { GoogleAdMob } from '@apps-in-toss/web-framework';

export const useTossRewardAd = (adUnitId: string) => {
  const [isLoaded, setIsLoaded] = useState(false);

  const load = useCallback(() => {
    try {
      console.log(`[AdMob-Reward] 광고 로드 시도 (adGroupId): ${adUnitId}`);
      GoogleAdMob.loadAppsInTossAdMob({
        options: { adGroupId: adUnitId } as any,
        onEvent: (event: { type: string }) => {
          console.log(`[AdMob-Reward] Load Event: ${event.type}`);
          if (event.type === 'loaded') {
            console.log('[AdMob-Reward] 광고 로드 완료 (onAdLoaded)');
            setIsLoaded(true);
          }
        },
        onError: (error: unknown) => {
          console.error('[AdMob-Reward] 광고 로드 실패 (onAdFailedToLoad):', error);
          setIsLoaded(false);
        },
      });
    } catch (e) {
      console.error('[AdMob-Reward] loadAppsInTossAdMob 호출 실패:', e);
    }
  }, [adUnitId]);

  const show = useCallback((onRewardEarned: () => void, onDismiss?: () => void) => {
    if (!isLoaded) {
      console.warn('[AdMob-Reward] 광고가 아직 로드되지 않았습니다.');
      // 리워드 광고는 로드되지 않았으면 보상을 주지 않는 것이 일반적이나,
      // 사용자 경험상 에러 상황에서는 그냥 보상을 줄지 정책 결정 필요.
      // 여기서는 일단 보상을 주지 않고 알림만 띄우거나, 개발 단계 편의를 위해 바로 콜백 실행 (선택)
      // alert('광고를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      // return;
      
      // 사용자 편의를 위해 광고 실패 시에도 보상 지급 (정책에 따라 주석 처리)
      onRewardEarned();
      if (onDismiss) onDismiss();
      return;
    }

    try {
      console.log(`[AdMob-Reward] 광고 노출 시도 (adGroupId): ${adUnitId}`);
      GoogleAdMob.showAppsInTossAdMob({
        options: { adGroupId: adUnitId } as any,
        onEvent: (event: { type: string; data?: any }) => {
          console.log(`[AdMob-Reward] Show Event: ${event.type}`, event.data);
          
          if (event.type === 'userEarnedReward') {
            console.log('[AdMob-Reward] 보상 획득 성공!');
            onRewardEarned();
          }

          if (
            event.type === 'dismissed' || 
            event.type === 'closed' || 
            event.type === 'onAdDismissedFullScreenContent'
          ) {
            console.log('[AdMob-Reward] 광고 닫힘');
            if (onDismiss) onDismiss();
            setIsLoaded(false);
            load(); // 다음 광고 로드
          }
        },
        onError: (error: unknown) => {
          console.error('[AdMob-Reward] 광고 노출 실패:', error);
          // 노출 실패 시에도 보상을 줄지 여부는 정책 결정 필요
          // onRewardEarned(); 
          if (onDismiss) onDismiss();
          setIsLoaded(false);
          load();
        },
      });
    } catch (e) {
      console.error('[AdMob-Reward] showAppsInTossAdMob 호출 실패:', e);
      if (onDismiss) onDismiss();
    }
  }, [adUnitId, isLoaded, load]);

  useEffect(() => {
    if (typeof GoogleAdMob?.loadAppsInTossAdMob?.isSupported === 'function') {
      if (GoogleAdMob.loadAppsInTossAdMob.isSupported()) {
        load();
      } else {
        console.warn('[AdMob-Reward] 현재 환경에서 AdMob을 지원하지 않습니다.');
      }
    } else {
      load();
    }
  }, [load]);

  return { isLoaded, show };
};
