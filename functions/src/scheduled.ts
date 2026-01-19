import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * 10분마다 실행되어 투표가 종료된 게시물의 상태를 'CLOSED'로 변경하는 스케줄링 함수입니다.
 */
export const closeExpiredCases = functions
  .region('asia-northeast3')
  .pubsub.schedule('every 10 minutes') // 10분 간격으로 실행
  .onRun(async (context) => {
    functions.logger.log('Running scheduled job to close expired cases...');

    const now = new Date();
    
    // 쿼리: status가 'OPEN'이고, voteEndAt이 현재 시간보다 과거인 게시물
    const query = db.collection('cases')
      .where('status', '==', 'OPEN')
      .where('voteEndAt', '<=', now);

    try {
      const expiredCasesSnapshot = await query.get();

      if (expiredCasesSnapshot.empty) {
        functions.logger.log('No expired cases to close.');
        return null;
      }

      // 한 번에 여러 문서를 업데이트하기 위해 Batch Write를 사용합니다.
      const batch = db.batch();
      expiredCasesSnapshot.forEach(doc => {
        functions.logger.log(`Closing case: ${doc.id}`);
        batch.update(doc.ref, { status: 'CLOSED' });
      });

      // Batch Write 실행
      await batch.commit();
      functions.logger.log(`Successfully closed ${expiredCasesSnapshot.size} cases.`);
      
      return null;

    } catch (error) {
      functions.logger.error('Error closing expired cases:', error);
      return null;
    }
  });
