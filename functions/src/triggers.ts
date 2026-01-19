import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Firestore 인스턴스를 한 번만 초기화하여 재사용합니다.
const db = admin.firestore();

/**
 * 주어진 caseId에 대한 hotScore를 다시 계산하고 업데이트하는 재사용 가능한 함수입니다.
 * @param caseId - 업데이트할 게시물의 ID
 */
const recalculateHotScore = async (caseId: string): Promise<void> => {
  const caseRef = db.collection('cases').doc(caseId);

  // 투표(votes) 서브컬렉션의 문서 개수를 가져옵니다.
  const votesQuery = caseRef.collection('votes');
  const votesSnapshot = await votesQuery.get();
  const voteCount = votesSnapshot.size;

  // 댓글(comments) 서브컬렉션의 문서 개수를 가져옵니다.
  // 참고: 통합명세서의 '동일 사용자 댓글 1회만 반영' 규칙은 일단 댓글 총 개수로 단순화하여 구현합니다.
  const commentsQuery = caseRef.collection('comments');
  const commentsSnapshot = await commentsQuery.get();
  const commentCount = commentsSnapshot.size;

  // hotScore를 계산합니다: 총 투표 수 + (총 댓글 수 * 2)
  const hotScore = voteCount + (commentCount * 2);

  functions.logger.log(
    `Updating hotScore for case: ${caseId}. Votes: ${voteCount}, Comments: ${commentCount}, New HotScore: ${hotScore}`
  );

  // 계산된 hotScore로 'cases' 문서의 필드를 업데이트합니다.
  await caseRef.update({ hotScore });
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
      functions.logger.error(
        `[onVoteCreate] Failed to update hot score for case ${context.params.caseId}`,
        error
      );
    }
  });

/**
 * 새로운 댓글이 생성될 때 실행되는 Firestore 트리거입니다.
 * 'cases/{caseId}/comments/{commentId}' 경로에 문서가 생성되면 hotScore를 업데이트합니다.
 */
export const onCommentCreate = functions.region('asia-northeast3')
  .firestore.document('cases/{caseId}/comments/{commentId}')
  .onCreate(async (snapshot, context) => {
    try {
      const caseId = context.params.caseId;
      await recalculateHotScore(caseId);
    } catch (error) {
      functions.logger.error(
        `[onCommentCreate] Failed to update hot score for case ${context.params.caseId}`,
        error
      );
    }
  });

/**
 * 투표가 삭제될 때 실행되는 Firestore 트리거입니다.
 */
export const onVoteDelete = functions.region('asia-northeast3')
  .firestore.document('cases/{caseId}/votes/{voteId}')
  .onDelete(async (snapshot, context) => {
    try {
      const caseId = context.params.caseId;
      await recalculateHotScore(caseId);
    } catch (error) {
      functions.logger.error(
        `[onVoteDelete] Failed to update hot score for case ${context.params.caseId}`,
        error
      );
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
      await recalculateHotScore(caseId);
    } catch (error) {
      functions.logger.error(
        `[onCommentDelete] Failed to update hot score for case ${context.params.caseId}`,
        error
      );
    }
  });
