import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// DB 접근 헬퍼: 초기화 상태 확인 및 지연 초기화
// 명시적으로 기본 자격 증명(applicationDefault)을 사용하여 권한 오류 방지
const getDb = () => {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
  }
  return admin.firestore();
};

/**
 * 주어진 caseId에 대한 hotScore를 다시 계산하고 업데이트하는 재사용 가능한 함수입니다.
 * @param caseId - 업데이트할 게시물의 ID
 */
const recalculateHotScore = async (caseId: string): Promise<void> => {
  const db = getDb();
  const caseRef = db.collection('cases').doc(caseId);

  // 투표(votes) 서브컬렉션의 문서 개수를 가져옵니다.
  const votesQuery = caseRef.collection('votes');
  const votesSnapshot = await votesQuery.get();
  const voteCount = votesSnapshot.size;

  // commentCount 필드값을 가져옵니다 (트리거에 의해 업데이트됨)
  const caseDoc = await caseRef.get();
  const commentCount = caseDoc.data()?.commentCount || 0;

  // hotScore를 계산합니다: 총 투표 수 + (총 댓글 수 * 2)
  const hotScore = voteCount + (commentCount * 2);

  functions.logger.log(
    `Updating hotScore for case: ${caseId}. Votes: ${voteCount}, Comments: ${commentCount}, New HotScore: ${hotScore}`
  );

  // 계산된 hotScore로 'cases' 문서의 필드를 업데이트합니다.
  await caseRef.update({ hotScore });
};

/**
 * 게시물 문서의 commentCount를 증감시키는 함수
 */
const updateCommentCount = async (caseId: string, delta: number) => {
  const db = getDb();
  const caseRef = db.collection('cases').doc(caseId);
  await caseRef.update({
    commentCount: admin.firestore.FieldValue.increment(delta)
  });
};

/**
 * 새로운 투표가 생성될 때 실행되는 Firestore 트리거입니다.
 * 'cases/{caseId}/votes/{voteId}' 경로에 문서가 생성되면 hotScore를 업데이트합니다.
 */
export const onVoteCreate = functions.region('asia-northeast3')
  .firestore.document('cases/{caseId}/votes/{voteId}')
  .onCreate(async (snapshot, context) => {
    try {
      const caseId = context.params.caseId;
      await recalculateHotScore(caseId);
    } catch (error) {
      functions.logger.error(`[onVoteCreate] Failed for case ${context.params.caseId}`, error);
    }
  });

export const onVoteDelete = functions.region('asia-northeast3')
  .firestore.document('cases/{caseId}/votes/{voteId}')
  .onDelete(async (snapshot, context) => {
    try {
      const caseId = context.params.caseId;
      await recalculateHotScore(caseId);
    } catch (error) {
      functions.logger.error(`[onVoteDelete] Failed for case ${context.params.caseId}`, error);
    }
  });

/**
 * 새로운 댓글이 생성될 때 실행되는 Firestore 트리거입니다.
 */
export const onCommentCreate = functions.region('asia-northeast3')
  .firestore.document('cases/{caseId}/comments/{commentId}')
  .onCreate(async (snapshot, context) => {
    try {
      const caseId = context.params.caseId;
      await updateCommentCount(caseId, 1);
      await recalculateHotScore(caseId);
    } catch (error) {
      functions.logger.error(`[onCommentCreate] Failed for case ${context.params.caseId}`, error);
    }
  });

/**
 * 댓글이 삭제될 때 실행되는 Firestore 트리거입니다.
 */
export const onCommentDelete = functions.region('asia-northeast3')
  .firestore.document('cases/{caseId}/comments/{commentId}')
  .onDelete(async (snapshot, context) => {
    try {
      const caseId = context.params.caseId;
      await updateCommentCount(caseId, -1);
      await recalculateHotScore(caseId);
    } catch (error) {
      functions.logger.error(`[onCommentDelete] Failed for case ${context.params.caseId}`, error);
    }
  });

/**
 * 대댓글 생성 트리거
 */
export const onReplyCreate = functions.region('asia-northeast3')
  .firestore.document('cases/{caseId}/comments/{commentId}/replies/{replyId}')
  .onCreate(async (snapshot, context) => {
    try {
      const caseId = context.params.caseId;
      await updateCommentCount(caseId, 1);
      await recalculateHotScore(caseId);
    } catch (error) {
      functions.logger.error(`[onReplyCreate] Failed for case ${context.params.caseId}`, error);
    }
  });

/**
 * 대댓글 삭제 트리거
 */
export const onReplyDelete = functions.region('asia-northeast3')
  .firestore.document('cases/{caseId}/comments/{commentId}/replies/{replyId}')
  .onDelete(async (snapshot, context) => {
    try {
      const caseId = context.params.caseId;
      await updateCommentCount(caseId, -1);
      await recalculateHotScore(caseId);
    } catch (error) {
      functions.logger.error(`[onReplyDelete] Failed for case ${context.params.caseId}`, error);
    }
  });

/**
 * (관리자용) 모든 게시물의 HotScore를 일괄 재계산하는 HTTP 함수
 * 배포 후 브라우저에서 접속하여 실행: /recalculateAllHotScores
 */
export const recalculateAllHotScores = functions.region('asia-northeast3')
  .runWith({ 
    timeoutSeconds: 540, 
    memory: '512MB',
    enforceAppCheck: false // App Check 강제 비활성화 (권한 오류 방지)
  })
  .https.onRequest(async (req, res) => {
    const db = getDb();
    
    // 디버깅을 위한 프로젝트 ID 로깅
    const projectId = process.env.GCLOUD_PROJECT || 'unknown';
    functions.logger.info(`Starting hotScore recalculation. Project: ${projectId}`);

    try {
      const casesSnapshot = await db.collection('cases').get();
      
      if (casesSnapshot.empty) {
        functions.logger.info('No cases found.');
        res.status(200).send('No cases found to update.');
        return;
      }

      let updatedCount = 0;
      const batchSize = 50;
      const chunks = [];
      
      const docs = casesSnapshot.docs;
      for (let i = 0; i < docs.length; i += batchSize) {
        chunks.push(docs.slice(i, i + batchSize));
      }

      for (const chunk of chunks) {
        await Promise.all(chunk.map(doc => recalculateHotScore(doc.id)));
        updatedCount += chunk.length;
        functions.logger.info(`Processed ${updatedCount}/${casesSnapshot.size} cases`);
      }
      
      res.status(200).send(`Successfully updated hot scores for ${updatedCount} cases. Project: ${projectId}`);
    } catch (error) {
      functions.logger.error("Failed to recalculate all hot scores", error);
      res.status(500).send(`Failed to update hot scores. Error: ${error}`);
    }
  });
