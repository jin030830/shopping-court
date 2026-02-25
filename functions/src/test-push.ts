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
  console.log('1. 일반 메시지 전송 (sendMessage) - 작성자 알림 (shopping-court-enduser)');
  console.log('2. 테스트 메시지 전송 (sendTestMessage) - 작성자 알림');
  console.log('3. 일반 메시지 전송 (sendMessage) - 투표자 알림 (shopping-court-participateend)');
  console.log('4. 테스트 메시지 전송 (sendTestMessage) - 투표자 알림');

  const mode = await askQuestion('선택하세요 (1, 2, 3, 4): ');

  if (!['1', '2', '3', '4'].includes(mode)) {
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

  let caseId = 'case-test-1234';
  if (mode === '3' || mode === '4') {
    const inputCaseId = await askQuestion('Case ID (딥링크용)를 입력하세요 (기본값: case-test-1234): ');
    if (inputCaseId) caseId = inputCaseId;
  }

  // mode에 따른 분기
  const isVoter = mode === '3' || mode === '4';
  const isTestMsg = mode === '2' || mode === '4';

  const templateSetCode = isVoter ? 'shopping-court-participateend' : 'shopping-court-enduser';
  const context: Record<string, string> = isVoter ? { caseId } : {};

  try {
    if (!isTestMsg) {
      console.log(`\n📡 일반 메시지 전송 중... 템플릿: ${templateSetCode}`);
      await sendTossPush(userKey, context, templateSetCode);
    } else {
      const deploymentId = await askQuestion('Deployment ID를 입력하세요 (예: test1): ');
      if (!deploymentId) {
        console.log('❌ Deployment ID는 필수입니다.');
        rl.close();
        return;
      }
      console.log(`\n📡 테스트 메시지 전송 중... 템플릿: ${templateSetCode}`);
      await sendTestTossPush(userKey, deploymentId, context, templateSetCode);
    }
  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error);
  } finally {
    rl.close();
  }
}

runTest();