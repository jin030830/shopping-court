import { sendTestTossPush, sendTossPush } from './toss';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

// .env 로드
dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function runTest() {
  console.log('🚀 토스 푸시 알림 전송 테스트 도구');
  console.log('-----------------------------------');
  console.log('1. 일반 메시지 전송 (sendMessage)');
  console.log('2. 테스트 메시지 전송 (sendTestMessage)');
  
  const mode = await askQuestion('선택하세요 (1 또는 2): ');

  if (mode !== '1' && mode !== '2') {
    console.log('❌ 잘못된 선택입니다.');
    rl.close();
    return;
  }

  const userKey = await askQuestion('User Key를 입력하세요: ');
  if (!userKey) {
    console.log('❌ User Key는 필수입니다.');
    rl.close();
    return;
  }

  // context를 빈 객체로 고정
  const context = {};

  try {
    if (mode === '1') {
      console.log('\n📡 일반 메시지 전송 중...');
      await sendTossPush(userKey, context);
    } else {
      const deploymentId = await askQuestion('Deployment ID를 입력하세요: ');
      if (!deploymentId) {
        console.log('❌ Deployment ID는 필수입니다.');
        rl.close();
        return;
      }
      console.log('\n📡 테스트 메시지 전송 중...');
      
      // 템플릿 코드 포함하여 전송 (context는 빈 객체)
      await sendTestTossPush(userKey, deploymentId, context, 'shopping-court-enduser');
    }
  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error);
  } finally {
    rl.close();
  }
}

runTest();