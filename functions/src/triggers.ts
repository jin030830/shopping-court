import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// DB 접근 헬퍼
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
  const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kstDate.toISOString().split('T')[0];
};

/**
 * Timestamp를 KST 날짜 문자열로 변환
 */
const timestampToDateString = (timestamp: admin.firestore.Timestamp): string => {
  const date = timestamp.toDate();
  const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kstDate.toISOString().split('T')[0];
};

/**
 * 사용자 활동 통계를 업데이트하는 함수
 */
const updateUserStats = async (
  userId: string, 
  type: 'vote' | 'comment' | 'post', 
  action: 'create' | 'delete',
  createdAt?: admin.firestore.Timestamp
) => {
  const db = getDb();
  const userRef = db.collection('users').doc(userId);
  const today = getTodayDateString();

  try {
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) return;

      const userData = userDoc.data();
      let dailyStats = userData?.dailyStats || {
        lastActiveDate: today,
        voteCount: 0,
        commentCount: 0,
        postCount: 0,
        isLevel1Claimed: false,
        isLevel2Claimed: false
      };

      // 1. 일일 통계 초기화 (날짜 변경 시)
      if (dailyStats.lastActiveDate !== today) {
        dailyStats = {
          lastActiveDate: today,
          voteCount: 0,
          commentCount: 0,
          postCount: 0,
          isLevel1Claimed: false,
          isLevel2Claimed: false
        };
      }

      // 2. 카운트 업데이트 로직
      if (action === 'create') {
        if (type === 'vote') dailyStats.voteCount = (dailyStats.voteCount || 0) + 1;
        if (type === 'comment') dailyStats.commentCount = (dailyStats.commentCount || 0) + 1;
        if (type === 'post') dailyStats.postCount = (dailyStats.postCount || 0) + 1;
      } else if (action === 'delete') {
        if (createdAt) {
          const createdDate = timestampToDateString(createdAt);
          if (createdDate === today) {
             if (type === 'vote') dailyStats.voteCount = Math.max(0, (dailyStats.voteCount || 0) - 1);
             if (type === 'comment') dailyStats.commentCount = Math.max(0, (dailyStats.commentCount || 0) - 1);
             if (type === 'post') dailyStats.postCount = Math.max(0, (dailyStats.postCount || 0) - 1);
          }
        }
      }

      // 3. 업데이트 적용
      const updates: any = {
        dailyStats: dailyStats
      };
      
      transaction.update(userRef, updates);
    });
    functions.logger.log(`Updated user stats for ${userId}, type: ${type}, action: ${action}`);
  } catch (error) {
    functions.logger.error(`Failed to update user stats for ${userId}`, error);
  }
};

/**
 * 게시물의 모든 수치(투표, 댓글)를 실제 문서 개수와 동기화하는 함수 (Source of Truth)
 */
export const syncCaseCounts = async (caseId: string) => {
  const db = admin.firestore();
  const caseRef = db.collection('cases').doc(caseId);

  try {
    // 1. 모든 관련 문서 카운트 (Promise.all로 병렬 처리)
    const [votesSnap, commentsSnap, repliesSnap] = await Promise.all([
      caseRef.collection('votes').get(),
      caseRef.collection('comments').get(),
      db.collectionGroup('replies').where('authorId', '!=', '').get() // 대댓글은 필터링 로직에 따라 조정 가능
    ]);

    // 해당 게시물에 속한 대댓글만 필터링 (collectionGroup은 전체를 가져오므로 경로 체크)
    const filteredReplies = repliesSnap.docs.filter(doc => doc.ref.path.includes(`cases/${caseId}/`));

    const guiltyCount = votesSnap.docs.filter(d => d.data().vote === 'guilty').length;
    const innocentCount = votesSnap.docs.filter(d => d.data().vote === 'innocent').length;
    const commentCount = commentsSnap.size + filteredReplies.length;

    const voteCount = guiltyCount + innocentCount;
    const hotScore = voteCount + (commentCount * 2);

    await caseRef.update({
      guiltyCount,
      innocentCount,
      commentCount,
      hotScore,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    functions.logger.log(`[Sync] Case ${caseId} synced: G:${guiltyCount}, I:${innocentCount}, C:${commentCount}`);
  } catch (error) {
    functions.logger.error(`[Sync Error] Failed to sync case ${caseId}:`, error);
  }
};

/**
 * 주어진 caseId에 대한 hotScore를 다시 계산하고 업데이트하는 함수
 */
const recalculateHotScore = async (caseId: string): Promise<void> => {
  const db = getDb();
  const caseRef = db.collection('cases').doc(caseId);

  const caseDoc = await caseRef.get();
  const data = caseDoc.data();

  if (!data) return;

  const guiltyCount = Math.max(0, data.guiltyCount || 0);
  const innocentCount = Math.max(0, data.innocentCount || 0);
  const commentCount = Math.max(0, data.commentCount || 0);
  
  const voteCount = guiltyCount + innocentCount;
  const hotScore = voteCount + (commentCount * 2);

  await caseRef.update({ 
    guiltyCount, 
    innocentCount, 
    commentCount, 
    hotScore 
  });
};

/**
 * 게시물 문서의 commentCount를 증감시키는 함수
 */
const updateCommentCount = async (caseId: string, delta: number) => {
  const db = getDb();
  const caseRef = db.collection('cases').doc(caseId);
  
  try {
    const caseDoc = await caseRef.get();
    if (!caseDoc.exists) return; // 게시물이 이미 없으면 업데이트 안함

    const currentCount = caseDoc.data()?.commentCount || 0;
    await caseRef.update({
      commentCount: Math.max(0, currentCount + delta)
    });
  } catch (error) {
    functions.logger.warn(`Failed to update comment count for ${caseId} (may be already deleted)`);
  }
};

export const onCaseCreate = functions.region('asia-northeast3')
  .firestore.document('cases/{caseId}')
  .onCreate(async (snapshot, context) => {
    try {
      const data = snapshot.data();
      const authorId = data.authorId;
      if (authorId) {
        await updateUserStats(authorId, 'post', 'create');
      }
    } catch (error) {
      functions.logger.error(`[onCaseCreate] Error`, error);
    }
  });

export const onCaseDelete = functions.region('asia-northeast3')
  .firestore.document('cases/{caseId}')
  .onDelete(async (snapshot, context) => {
    try {
      const data = snapshot.data();
      const authorId = data.authorId;
      const createdAt = data.createdAt;
      if (authorId) {
        await updateUserStats(authorId, 'post', 'delete', createdAt);
      }
    } catch (error) {
      functions.logger.error(`[onCaseDelete] Error`, error);
    }
  });

export const onVoteCreate = functions.region('asia-northeast3')
  .firestore.document('cases/{caseId}/votes/{voteId}')
  .onCreate(async (snapshot, context) => {
    try {
      const voteId = context.params.voteId;
      await updateUserStats(voteId, 'vote', 'create');
      
      // 카운트 업데이트는 이제 클라이언트(addVote)에서 트랜잭션으로 처리하므로 
      // 트리거에서는 hotScore 재계산만 수행합니다.
      await recalculateHotScore(context.params.caseId);
    } catch (error) {
      functions.logger.error(`[onVoteCreate] Error`, error);
    }
  });

export const onVoteDelete = functions.region('asia-northeast3')
  .firestore.document('cases/{caseId}/votes/{voteId}')
  .onDelete(async (snapshot, context) => {
    try {
      const voteId = context.params.voteId;
      const data = snapshot.data();
      const createdAt = data.createdAt; 
      
      await updateUserStats(voteId, 'vote', 'delete', createdAt);

      const db = getDb();
      const caseRef = db.collection('cases').doc(context.params.caseId);
      
      const caseDoc = await caseRef.get();
      if (!caseDoc.exists) {
        functions.logger.log(`Case ${context.params.caseId} already deleted, skipping count update.`);
        return;
      }

      // 삭제 시에는 클라이언트에서 처리하기 어려우므로 트리거에서 차감 유지
      const currentGuilty = caseDoc.data()?.guiltyCount || 0;
      const currentInnocent = caseDoc.data()?.innocentCount || 0;

      if (data.vote === 'guilty') {
        await caseRef.update({ 
          guiltyCount: Math.max(0, currentGuilty - 1) 
        });
      } else {
        await caseRef.update({ 
          innocentCount: Math.max(0, currentInnocent - 1) 
        });
      }
      await recalculateHotScore(context.params.caseId);
    } catch (error) {
      functions.logger.error(`[onVoteDelete] Error`, error);
    }
  });

export const onCommentCreate = functions.region('asia-northeast3')
  .firestore.document('cases/{caseId}/comments/{commentId}')
  .onCreate(async (snapshot, context) => {
    try {
      const data = snapshot.data();
      const authorId = data.authorId;
      const caseId = context.params.caseId;

      await updateCommentCount(caseId, 1);
      await recalculateHotScore(caseId);
      
      if (authorId) {
        await updateUserStats(authorId, 'comment', 'create');
      }
    } catch (error) {
      functions.logger.error(`[onCommentCreate] Error`, error);
    }
  });

export const onCommentDelete = functions.region('asia-northeast3')
  .firestore.document('cases/{caseId}/comments/{commentId}')
  .onDelete(async (snapshot, context) => {
    try {
      const data = snapshot.data();
      const authorId = data.authorId;
      const createdAt = data.createdAt;
      const caseId = context.params.caseId;
      
      if (authorId) {
        await updateUserStats(authorId, 'comment', 'delete', createdAt);
      }

      await updateCommentCount(caseId, -1);
      await recalculateHotScore(caseId);
    } catch (error) {
      functions.logger.error(`[onCommentDelete] Error`, error);
    }
  });

// [추가] 대댓글 트리거 구현
export const onReplyCreate = functions.region('asia-northeast3')
  .firestore.document('cases/{caseId}/comments/{commentId}/replies/{replyId}')
  .onCreate(async (snapshot, context) => {
    try {
      const data = snapshot.data();
      const authorId = data.authorId;
      const caseId = context.params.caseId;

      await updateCommentCount(caseId, 1);
      await recalculateHotScore(caseId);

      if (authorId) {
        await updateUserStats(authorId, 'comment', 'create');
      }
    } catch (error) {
      functions.logger.error(`[onReplyCreate] Error`, error);
    }
  });

export const onReplyDelete = functions.region('asia-northeast3')
  .firestore.document('cases/{caseId}/comments/{commentId}/replies/{replyId}')
  .onDelete(async (snapshot, context) => {
    try {
      const data = snapshot.data();
      const authorId = data.authorId;
      const createdAt = data.createdAt;
      const caseId = context.params.caseId;

      if (authorId) {
        await updateUserStats(authorId, 'comment', 'delete', createdAt);
      }

      await updateCommentCount(caseId, -1);
      await recalculateHotScore(caseId);
    } catch (error) {
      functions.logger.error(`[onReplyDelete] Error`, error);
    }
  });