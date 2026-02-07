import { useNavigate } from 'react-router-dom';
import { Asset, Text, Spacing } from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';

function StaticMarketingPage() {
  const navigate = useNavigate();
  
  return (
    <div style={{ 
      backgroundColor: '#F8F9FA', 
      minHeight: '100vh',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <Spacing size={14} />
      <div style={{ 
        display: 'flex', 
        alignItems: 'center',
        padding: '14px 20px',
        backgroundColor: 'white',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <button
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/', { replace: true });
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <Asset.Icon
            frameShape={Asset.frameShape.CleanW20}
            name="icon-arrow-left-mono"
            color="#191F28"
            aria-label="뒤로가기"
          />
        </button>
        <Spacing size={8} />
        <Text color={adaptive.grey900} typography="t6" fontWeight="semibold">
          뒤로가기
        </Text>
      </div>
      
      <div style={{ 
        padding: '20px',
        backgroundColor: 'white',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <Text 
          display="block" 
          color="#191F28ff" 
          typography="t2" 
          fontWeight="bold"
          style={{ marginBottom: '16px' }}
        >
          마케팅 정보 수신 동의
        </Text>
        
        <Text 
          display="block" 
          color="#191F28" 
          typography="t7" 
          fontWeight="regular"
          style={{ marginBottom: '16px', lineHeight: '1.6' }}
        >
          <strong>시행일:</strong> 2026.01.12<br />
          <strong>회사:</strong> 다향관 구멍가게(이하 "회사")<br />
          <strong>문의:</strong> hhon0213@naver.com / 010-4049-8130
        </Text>

        <Text 
          display="block" 
          color="#191F28" 
          typography="t7" 
          fontWeight="regular"
          style={{ marginBottom: '24px', lineHeight: '1.6' }}
        >
          본 동의는 서비스 이용에 필수적이지 않으며, 동의하지 않아도 소비재판소 서비스를 정상적으로 이용할 수 있습니다.
        </Text>

        <Text 
          display="block" 
          color="#191F28ff" 
          typography="t4" 
          fontWeight="bold"
          style={{ marginTop: '24px', marginBottom: '16px' }}
        >
          1. 수신 목적
        </Text>
        <p>회사는 아래 목적을 위해 광고성 정보(마케팅 정보)를 전송할 수 있습니다.</p>
        <ul>
          <li>서비스 기능 업데이트, 이벤트/프로모션, 혜택 안내</li>
          <li>신규 서비스/콘텐츠/공지 사항 안내</li>
          <li>설문조사 및 서비스 개선을 위한 안내(프로모션 포함 가능)</li>
        </ul>

        <h2>2. 전송 방법</h2>
        <p>회사는 다음 전자적 전송매체를 통해 마케팅 정보를 전송할 수 있습니다.</p>
        <ul>
          <li>앱 푸시 알림</li>
          <li>문자메시지(SMS/LMS/MMS)</li>
          <li>이메일</li>
          <li>서비스 내 알림(인앱 메시지)</li>
        </ul>
        <p>※ 실제 전송 수단은 서비스 운영 상황에 따라 달라질 수 있습니다.</p>

        <h2>3. 수집·이용 항목</h2>
        <p>마케팅 정보 전송을 위해 다음 정보가 이용될 수 있습니다.</p>
        <ul>
          <li>(선택) 연락처(휴대전화번호), 이메일</li>
          <li>(공통) 서비스 이용기록(수신 여부/일시, 이벤트 참여 여부 등 최소 범위)</li>
        </ul>
        <p>※ 앱인토스(토스) 로그인에서 제공되는 항목 중 이용자가 동의한 범위에서만 이용됩니다.</p>

        <h2>4. 보유 및 이용 기간</h2>
        <p>마케팅 정보 수신 동의일로부터 동의 철회 시까지 보유·이용합니다.</p>
        <p>단, 관련 법령에 따라 보관이 필요한 경우 해당 기간 동안 보관할 수 있습니다.</p>

        <h2>5. 동의 철회(수신 거부) 방법</h2>
        <p>이용자는 언제든지 마케팅 정보 수신 동의를 철회할 수 있습니다.</p>
        <ul>
          <li>서비스 내 설정(제공 시)에서 수신 거부</li>
          <li>각 메시지 내 "수신거부" 안내에 따른 거부(제공 시)</li>
          <li>고객문의: hhon0213@naver.com / 010-4049-8130로 요청</li>
        </ul>
        <p>동의 철회 시 회사는 지체 없이 마케팅 정보 발송을 중단합니다.</p>
      </div>
    </div>
  )
}

export default StaticMarketingPage