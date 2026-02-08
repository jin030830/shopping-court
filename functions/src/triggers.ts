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

      if (dailyStats.lastActiveDate !== today) {
        dailyStats = { lastActiveDate: today, voteCount: 0, commentCount: 0, postCount: 0, isLevel1Claimed: false, isLevel2Claimed: false };
      }

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

      transaction.update(userRef, { dailyStats });
    });
  } catch (error) {
    functions.logger.error(`Failed to update user stats for ${userId}`, error);
  }
};

/**
 * 게시물의 모든 수치(투표, 댓글)를 실제 문서 개수와 동기화하는 함수
 */
export const syncCaseCounts = async (caseId: string) => {
  const db = admin.firestore();
  const caseRef = db.collection('cases').doc(caseId);

  try {
    const [votesSnap, commentsSnap, repliesSnap] = await Promise.all([
      caseRef.collection('votes').get(),
      caseRef.collection('comments').get(),
      db.collectionGroup('replies').get()
    ]);

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
  
  const hotScore = (guiltyCount + innocentCount) + (commentCount * 2);
  await caseRef.update({ guiltyCount, innocentCount, commentCount, hotScore });
};

/**
 * 게시물 문서의 수치를 안전하게 증감시키는 트랜잭션 함수
 */
const updateCountAtomic = async (caseId: string, field: string, delta: number) => {
  const db = getDb();
  const caseRef = db.collection('cases').doc(caseId);
  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(caseRef);
      if (!doc.exists) return;
      const current = doc.data()?.[field] || 0;
      transaction.update(caseRef, { [field]: Math.max(0, current + delta) });
    });
    await recalculateHotScore(caseId);
  } catch (e) {
    functions.logger.error(`[AtomicUpdate Error] ${caseId} ${field}`, e);
  }
};

export const onCaseCreate = functions.region('asia-northeast3').firestore.document('cases/{caseId}').onCreate(async (snapshot) => {
  const authorId = snapshot.data().authorId;
  if (authorId) await updateUserStats(authorId, 'post', 'create');
});

export const onCaseDelete = functions.region('asia-northeast3').firestore.document('cases/{caseId}').onDelete(async (snapshot) => {
  const data = snapshot.data();
  if (data.authorId) await updateUserStats(data.authorId, 'post', 'delete', data.createdAt);
});

export const onVoteCreate = functions.region('asia-northeast3').firestore.document('cases/{caseId}/votes/{voteId}').onCreate(async (snapshot, context) => {
  await updateUserStats(context.params.voteId, 'vote', 'create');
  await recalculateHotScore(context.params.caseId);
});

export const onVoteDelete = functions.region('asia-northeast3').firestore.document('cases/{caseId}/votes/{voteId}').onDelete(async (snapshot, context) => {
  const data = snapshot.data();
  await updateUserStats(context.params.voteId, 'vote', 'delete', data.createdAt);
  // 단순히 숫자를 빼는 대신, 실제 개수를 다시 세어서 동기화 (오차 0%)
  await syncCaseCounts(context.params.caseId);
});

export const onCommentCreate = functions.region('asia-northeast3').firestore.document('cases/{caseId}/comments/{commentId}').onCreate(async (snapshot, context) => {
  const authorId = snapshot.data().authorId;
  await updateCountAtomic(context.params.caseId, 'commentCount', 1);
  if (authorId) await updateUserStats(authorId, 'comment', 'create');
});

export const onCommentDelete = functions.region('asia-northeast3').firestore.document('cases/{caseId}/comments/{commentId}').onDelete(async (snapshot, context) => {
  const data = snapshot.data();
  if (data.authorId) await updateUserStats(data.authorId, 'comment', 'delete', data.createdAt);
  // 실제 개수 동기화
  await syncCaseCounts(context.params.caseId);
});

export const onReplyCreate = functions.region('asia-northeast3').firestore.document('cases/{caseId}/comments/{commentId}/replies/{replyId}').onCreate(async (snapshot, context) => {
  const authorId = snapshot.data().authorId;
  await updateCountAtomic(context.params.caseId, 'commentCount', 1);
  if (authorId) await updateUserStats(authorId, 'comment', 'create');
});

export const onReplyDelete = functions.region('asia-northeast3').firestore.document('cases/{caseId}/comments/{commentId}/replies/{replyId}').onDelete(async (snapshot, context) => {
  const data = snapshot.data();
  if (data.authorId) await updateUserStats(data.authorId, 'comment', 'delete', data.createdAt);
  // 실제 개수 동기화
  await syncCaseCounts(context.params.caseId);
});
