import AppRoutes from './routes/AppRoutes'
import { useTossRewardAd } from './hooks/useTossRewardAd'
import { useEffect } from 'react'

function App() {
  // [Zero-Wait] 앱 진입 시점부터 광고를 미리 로드하여 지연 시간을 제거합니다.
  const { load } = useTossRewardAd('ait.v2.live.ad43dc8f10064218');

  useEffect(() => {
    load();
  }, [load]);

  return <AppRoutes />
}

export default App