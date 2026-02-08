import { Text, Spacing } from '@toss/tds-mobile';

function StaticTermsPage() {
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <Spacing size={20} />
      <Text typography="t2" fontWeight="bold">약관 페이지 테스트 중</Text>
      <Spacing size={20} />
      <Text typography="t5">이 화면이 보인다면 렌더링은 정상입니다.</Text>
    </div>
  );
}

export default StaticTermsPage;