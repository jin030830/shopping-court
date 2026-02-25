import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { sendTossPush } from './toss';

const db = admin.firestore();

/**
 * 10분마다 실행되어 투표가 종료된 게시물의 상태를 'CLOSED'로 변경하고 작성자에게 푸시 알림을 보냅니다.
 */
export const closeExpiredCases = functions
  .region('asia-northeast3')
  .pubsub.schedule('every 10 minutes') // 10분 간격으로 실행
  .onRun(async (context: functions.EventContext) => {
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

      // 작성자 알림과 투표자 대상을 따로 수집합니다.
      const authorNotifications: { authorId: string; title: string; caseId: string }[] = [];
      const voterNotifications: { userId: string; caseId: string }[] = [];

      // 한 번에 여러 문서를 업데이트하기 위해 Batch Write를 사용합니다.
      const batch = db.batch();

      // 비동기 처리가 완료되도록 Promise.all로 감쌉니다.
      await Promise.all(expiredCasesSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        functions.logger.log(`Closing case: ${doc.id}`);

        batch.update(doc.ref, { status: 'CLOSED' });

        // 1. 작성자 대상 저장
        if (data.authorId) {
          authorNotifications.push({
            authorId: data.authorId,
            title: data.title || "재판이 종료되었습니다.",
            caseId: doc.id
          });
        }

        // 2. 투표자 목록 수집 (루트의 votes 컬렉션에서 해당 caseId 조회)
        try {
          const votesSnapshot = await db.collection('votes').where('caseId', '==', doc.id).get();
          votesSnapshot.forEach(voteDoc => {
            const voteData = voteDoc.data();
            if (voteData.userId && voteData.userId !== data.authorId) {
              voterNotifications.push({
                userId: voteData.userId,
                caseId: doc.id
              });
            }
          });
        } catch (vErr) {
          functions.logger.error(`Error fetching votes for case ${doc.id}:`, vErr);
        }
      }));

      // Db 업데이트 실행 (상태 변경)
      await batch.commit();
      functions.logger.log(`Successfully closed ${expiredCasesSnapshot.size} cases.`);

      // 공통 푸시 함수
      const sendPushesInChunks = async <T>(
        items: T[],
        chunkSize: number,
        processFn: (item: T) => Promise<any>
      ) => {
        for (let i = 0; i < items.length; i += chunkSize) {
          const chunk = items.slice(i, i + chunkSize);
          await Promise.all(chunk.map(processFn));
        }
      };

      // 1. 작성자 알림 발송 (기본 템플릿: 'shopping-court-enduser' 등)
      await sendPushesInChunks(authorNotifications, 500, noti =>
        sendTossPush(noti.authorId, {
          title: noti.title,
          caseId: noti.caseId
        })
      );
      functions.logger.log(`Sent ${authorNotifications.length} push notifications to authors.`);

      // 2. 투표자 알림 발송 (요청된 템플릿: 'shopping-court-participateend')
      await sendPushesInChunks(voterNotifications, 500, noti =>
        sendTossPush(noti.userId, {
          caseId: noti.caseId
        }, 'shopping-court-participateend')
      );
      functions.logger.log(`Sent ${voterNotifications.length} push notifications to voters.`);

      return null;

    } catch (error) {
      functions.logger.error('Error closing expired cases:', error);
      return null;
    }
  });
