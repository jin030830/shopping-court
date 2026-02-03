import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendTossPush } from './toss';

const db = admin.firestore();

/**
 * 10분마다 실행되어 투표가 종료된 게시물의 상태를 'CLOSED'로 변경하고 작성자에게 푸시 알림을 보냅니다.
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

      // 알림을 보낼 대상 정보를 미리 수집합니다.
      const notifications: { authorId: string; title: string; caseId: string }[] = [];

      // 한 번에 여러 문서를 업데이트하기 위해 Batch Write를 사용합니다.
      const batch = db.batch();
      expiredCasesSnapshot.forEach(doc => {
        const data = doc.data();
        functions.logger.log(`Closing case: ${doc.id}`);
        
        batch.update(doc.ref, { status: 'CLOSED' });
        
        // 작성자 ID와 게시물 제목 저장
        if (data.authorId) {
          notifications.push({
            authorId: data.authorId,
            title: data.title || "재판이 종료되었습니다.",
            caseId: doc.id
          });
        }
      });

      // Batch Write 실행
      await batch.commit();
      functions.logger.log(`Successfully closed ${expiredCasesSnapshot.size} cases.`);

      // 업데이트가 성공한 후 푸시 알림을 발송합니다.
      // (알림 실패가 전체 프로세스에 영향을 주지 않도록 개별적으로 처리)
      const appUrl = process.env.APP_URL || 'https://shopping-court.vercel.app';
      const pushPromises = notifications.map(noti => 
        sendTossPush(noti.authorId, {
          title: noti.title,
          caseId: noti.caseId,
          // 토스 메신저 템플릿에서 사용할 URL
          url: `${appUrl}/case/${noti.caseId}`
        })
      );

      await Promise.all(pushPromises);
      functions.logger.log(`Sent ${notifications.length} push notifications.`);
      
      return null;

    } catch (error) {
      functions.logger.error('Error closing expired cases:', error);
      return null;
    }
  });
