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
 * 오늘 날짜 문자열 반환 (KST 기준)
 */
const getTodayDateString = (): string => {
  const now = new Date();
  // 한국 시간대로 변환 (UTC+9)
  const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kstDate.toISOString().split('T')[0];
};

/**
 * 사용자 활동 통계를 업데이트하는 함수
 */
const updateUserStats = async (userId: string, type: 'vote' | 'comment' | 'post' | 'hotCase') => {
  const db = getDb();
  const userRef = db.collection('users').doc(userId);

  try {
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) return;

      const userData = userDoc.data();
      const today = getTodayDateString();
      const lastActiveDate = userData?.stats?.lastActiveDate;

      if (lastActiveDate !== today) {
        transaction.update(userRef, {
          'stats.voteCount': type === 'vote' ? 1 : 0,
          'stats.commentCount': type === 'comment' ? 1 : 0,
          'stats.postCount': type === 'post' ? 1 : 0,
          'stats.hotCaseCount': type === 'hotCase' ? 1 : 0,
          'stats.lastActiveDate': today,
          'missions.voteMission': { claimed: false, lastClaimedDate: '' },
          'missions.commentMission': { claimed: false, lastClaimedDate: '' },
          'missions.postMission': { claimed: false, lastClaimedDate: '' },
          'missions.hotCaseMission': { claimed: false, lastClaimedDate: '' },
        });
      } else {
        let fieldToIncrement = '';
        if (type === 'vote') fieldToIncrement = 'stats.voteCount';
        else if (type === 'comment') fieldToIncrement = 'stats.commentCount';
        else if (type === 'post') fieldToIncrement = 'stats.postCount';
        else if (type === 'hotCase') fieldToIncrement = 'stats.hotCaseCount';

        if (fieldToIncrement) {
          transaction.update(userRef, {
            [fieldToIncrement]: admin.firestore.FieldValue.increment(1)
          });
        }
      }
    });
    functions.logger.log(`Updated user stats for ${userId}, type: ${type}`);
  } catch (error) {
    functions.logger.error(`Failed to update user stats for ${userId}`, error);
  }
};

/**
 * 주어진 caseId에 대한 hotScore를 다시 계산하고 업데이트하는 재사용 가능한 함수입니다.
 * @param caseId - 업데이트할 게시물의 ID
 */
const recalculateHotScore = async (caseId: string): Promise<void> => {
  const db = getDb();
  const caseRef = db.collection('cases').doc(caseId);

  // Firestore 읽기 비용 최적화:
  // votes 서브컬렉션을 전체 조회(get)하지 않고, 부모 문서의 카운트 필드를 활용합니다.
  const caseDoc = await caseRef.get();
  const data = caseDoc.data();

  if (!data) {
    functions.logger.warn(`Case document not found for hotScore recalculation: ${caseId}`);
    return;
  }

  const guiltyCount = data.guiltyCount || 0;
  const innocentCount = data.innocentCount || 0;
  const commentCount = data.commentCount || 0;
  
  const voteCount = guiltyCount + innocentCount;

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
 * 새로운 게시물이 생성될 때 실행되는 Firestore 트리거입니다.
 */
export const onCaseCreate = functions.region('asia-northeast3')
  .firestore.document('cases/{caseId}')
  .onCreate(async (snapshot, context) => {
    try {
      const data = snapshot.data();
      const authorId = data.authorId;
      
      if (authorId) {
        await updateUserStats(authorId, 'post');
      }
    } catch (error) {
      functions.logger.error(`[onCaseCreate] Failed for case ${context.params.caseId}`, error);
    }
  });

/**
 * 게시물 문서의 투표 카운트(guiltyCount, innocentCount)를 증가시키는 함수
 */
const updateCaseVoteCount = async (caseId: string, voteType: 'guilty' | 'innocent') => {
  const db = getDb();
  const caseRef = db.collection('cases').doc(caseId);
  
  if (voteType === 'guilty') {
    await caseRef.update({
      guiltyCount: admin.firestore.FieldValue.increment(1)
    });
  } else if (voteType === 'innocent') {
    await caseRef.update({
      innocentCount: admin.firestore.FieldValue.increment(1)
    });
  }
};

/**
 * 새로운 투표가 생성될 때 실행되는 Firestore 트리거입니다.
 * 'cases/{caseId}/votes/{voteId}' 경로에 문서가 생성되면 hotScore를 업데이트하고 사용자 통계를 갱신합니다.
 */
export const onVoteCreate = functions.region('asia-northeast3')
  .firestore.document('cases/{caseId}/votes/{voteId}')
  .onCreate(async (snapshot, context) => {
    try {
      const caseId = context.params.caseId;
      const voteId = context.params.voteId; // voteId is userId
      const voteData = snapshot.data();
      const voteType = voteData.vote as 'guilty' | 'innocent';
      
      await updateCaseVoteCount(caseId, voteType);
      await recalculateHotScore(caseId);
      await updateUserStats(voteId, 'vote');
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
      const data = snapshot.data();
      const authorId = data.authorId;

      await updateCommentCount(caseId, 1);
      await recalculateHotScore(caseId);
      
      if (authorId) {
        await updateUserStats(authorId, 'comment');
      }
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
      const data = snapshot.data();
      const authorId = data.authorId;

      await updateCommentCount(caseId, 1);
      await recalculateHotScore(caseId);

      if (authorId) {
        await updateUserStats(authorId, 'comment');
      }
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