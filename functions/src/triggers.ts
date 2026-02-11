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

/**
 * 사용자 활동 통계를 업데이트하는 함수
 * (신버전 앱은 activities 카운트, 구버전 앱은 단순 증감 지원)
 */
const updateUserStats = async (
  userId: string, 
  type: 'vote' | 'comment' | 'post', 
  action: 'create' | 'delete',
  createdAt?: admin.firestore.Timestamp,
  forceIncrement?: boolean // 구버전 대응용 플래그
) => {
  const db = getDb();
  const userRef = db.collection('users').doc(userId);
  const today = getTodayDateString();

  try {
    let actualCount = -1;

    // 1. 신버전 앱 대응: activities 컬렉션 조회
    if (!forceIncrement) {
      const activitiesCollection = userRef.collection('activities');
      const startOfToday = new Date(today);
      const startOfTodayTimestamp = admin.firestore.Timestamp.fromDate(startOfToday);

      const snapshot = await activitiesCollection
        .where('type', '==', type)
        .where('createdAt', '>=', startOfTodayTimestamp)
        .get();
      
      // 활동 기록이 하나라도 있다면 신버전 유저로 간주하여 정확한 개수 사용
      if (snapshot.size > 0 || action === 'delete') {
        actualCount = snapshot.size;
      }
    }

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

      // 2. 카운트 결정 로직
      if (actualCount !== -1) {
        // 신버전: 실제 데이터 개수와 동기화
        if (type === 'vote') dailyStats.voteCount = actualCount;
        if (type === 'comment') dailyStats.commentCount = actualCount;
        if (type === 'post') dailyStats.postCount = actualCount;
      } else if (action === 'create') {
        // 구버전: 단순 +1 (활동 기록이 없는 경우)
        if (type === 'vote') dailyStats.voteCount = (dailyStats.voteCount || 0) + 1;
        if (type === 'comment') dailyStats.commentCount = (dailyStats.commentCount || 0) + 1;
        if (type === 'post') dailyStats.postCount = (dailyStats.postCount || 0) + 1;
      }

      transaction.update(userRef, { dailyStats });
    });
  } catch (error) {
    functions.logger.error(`Failed to sync user stats for ${userId}`, error);
  }
};

export const onActivityCreate = functions.region('asia-northeast3').firestore.document('users/{userId}/activities/{activityId}').onCreate(async (snapshot, context) => {
  const data = snapshot.data();
  // 활동 기록이 생성되면 즉시 전체 카운트 모드로 업데이트
  await updateUserStats(context.params.userId, data.type, 'create');
});

export const onActivityDelete = functions.region('asia-northeast3').firestore.document('users/{userId}/activities/{activityId}').onDelete(async (snapshot, context) => {
  const data = snapshot.data();
  await updateUserStats(context.params.userId, data.type, 'delete', data.createdAt);
});

export const onCaseCreate = functions.region('asia-northeast3').firestore.document('cases/{caseId}').onCreate(async (snapshot) => {
  const authorId = snapshot.data().authorId;
  // 게시물 생성은 구버전/신버전 공통으로 처리 가능하도록 +1 모드로 시작 (필요시 onActivityCreate가 보정)
  if (authorId) await updateUserStats(authorId, 'post', 'create', undefined, true);
});

export const onCaseDelete = functions.region('asia-northeast3').firestore.document('cases/{caseId}').onDelete(async (snapshot) => {
  const data = snapshot.data();
  if (data.authorId) await updateUserStats(data.authorId, 'post', 'delete', data.createdAt);
});

export const onVoteCreate = functions.region('asia-northeast3').firestore.document('cases/{caseId}/votes/{voteId}').onCreate(async (snapshot, context) => {
  // 유저 통계 업데이트는 onActivityCreate에서 전담하므로 여기서는 게시물 점수만 재계산합니다.
  await recalculateHotScore(context.params.caseId);
});

export const onVoteDelete = functions.region('asia-northeast3').firestore.document('cases/{caseId}/votes/{voteId}').onDelete(async (snapshot, context) => {
  // 활동 기록 삭제는 onActivityDelete에서 전담하므로 여기서는 게시물 수치만 동기화합니다.
  await syncCaseCounts(context.params.caseId);
});

export const onCommentCreate = functions.region('asia-northeast3').firestore.document('cases/{caseId}/comments/{commentId}').onCreate(async (snapshot, context) => {
  await updateCountAtomic(context.params.caseId, 'commentCount', 1);
  // 유저 통계 업데이트는 onActivityCreate에서 전담합니다.
});

export const onCommentDelete = functions.region('asia-northeast3').firestore.document('cases/{caseId}/comments/{commentId}').onDelete(async (snapshot, context) => {
  // 활동 기록 삭제는 onActivityDelete에서 전담합니다.
  await syncCaseCounts(context.params.caseId);
});

export const onCommentUpdate = functions.region('asia-northeast3').firestore.document('cases/{caseId}/comments/{commentId}').onUpdate(async (change, context) => {
  const newData = change.after.data();
  const oldData = change.before.data();

  // 신버전 앱: isDeleted: true로 상태가 변경될 때 대응 (통계 차감은 onActivityDelete에서 처리되므로 여기서는 게시물 수치만 동기화)
  if (!oldData.isDeleted && newData.isDeleted === true) {
    await syncCaseCounts(context.params.caseId);
  }
});

export const onReplyCreate = functions.region('asia-northeast3').firestore.document('cases/{caseId}/comments/{commentId}/replies/{replyId}').onCreate(async (snapshot, context) => {
  await updateCountAtomic(context.params.caseId, 'commentCount', 1);
  // 유저 통계 업데이트는 onActivityCreate에서 전담합니다.
});

export const onReplyDelete = functions.region('asia-northeast3').firestore.document('cases/{caseId}/comments/{commentId}/replies/{replyId}').onDelete(async (snapshot, context) => {
  // 활동 기록 삭제는 onActivityDelete에서 전담합니다.
  await syncCaseCounts(context.params.caseId);
});