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
    
    // [수정] 삭제되지 않은 댓글만 카운트 (메모리 필터링이 대댓글 구조상 안전함)
    // 참고: 쿼리로 where('isDeleted', '!=', true)를 쓰려면 복합 인덱스가 필요할 수 있어 메모리 방식 유지
    const activeCommentsCount = commentsSnap.docs.filter(d => !d.data().isDeleted).length;
    
    // 대댓글은 isDeleted 개념이 없다면 그대로, 있다면 필터링 (현재 구조상 대댓글은 즉시 삭제됨)
    const commentCount = activeCommentsCount + filteredReplies.length;

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

    // 1. 활동 기록(activities) 기반 카운팅 시도 (신버전 대응)
    if (!forceIncrement) {
      const activitiesCollection = userRef.collection('activities');
      const kstTodayStart = new Date(today + "T00:00:00+09:00");
      const startOfTodayTimestamp = admin.firestore.Timestamp.fromDate(kstTodayStart);

      const snapshot = await activitiesCollection
        .where('type', '==', type)
        .where('createdAt', '>=', startOfTodayTimestamp)
        .get();
      
      // 활동 기록이 하나라도 있다면 신버전 유저로 간주
      if (snapshot.size > 0 || action === 'delete') {
        actualCount = snapshot.size;
        functions.logger.info(`[UserStats] 신버전 유저 감지: ${userId}, ${type} 개수: ${actualCount}`);
      }
    }

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        functions.logger.warn(`[UserStats] 유저 문서를 찾을 수 없음: ${userId}`);
        return;
      }

      const userData = userDoc.data();
      let dailyStats = userData?.dailyStats || {
        lastActiveDate: today,
        voteCount: 0,
        commentCount: 0,
        postCount: 0,
        isLevel1Claimed: false,
        isLevel2Claimed: false
      };

      // 날짜가 바뀌었으면 초기화
      if (dailyStats.lastActiveDate !== today) {
        functions.logger.info(`[UserStats] 날짜 변경 초기화: ${userId}, ${dailyStats.lastActiveDate} -> ${today}`);
        dailyStats = { lastActiveDate: today, voteCount: 0, commentCount: 0, postCount: 0, isLevel1Claimed: false, isLevel2Claimed: false };
      }

      // 2. 카운트 결정 및 업데이트
      if (actualCount !== -1) {
        // 신버전: 실제 문서 개수와 일치시킴
        if (type === 'vote') dailyStats.voteCount = actualCount;
        if (type === 'comment') dailyStats.commentCount = actualCount;
        if (type === 'post') dailyStats.postCount = actualCount;
      } else if (action === 'create') {
        // 구버전: 활동 기록이 없으므로 수동으로 +1
        if (type === 'vote') dailyStats.voteCount = (dailyStats.voteCount || 0) + 1;
        if (type === 'comment') dailyStats.commentCount = (dailyStats.commentCount || 0) + 1;
        if (type === 'post') dailyStats.postCount = (dailyStats.postCount || 0) + 1;
        functions.logger.info(`[UserStats] 구버전 유저 수동 증가: ${userId}, ${type}`);
      }

      transaction.update(userRef, { dailyStats });
    });
  } catch (error) {
    functions.logger.error(`[UserStats Error] ${userId} 업데이트 실패:`, error);
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

/**
 * 구버전 앱 유저를 위해 활동 기록(activities)을 백엔드에서 대리 생성합니다.
 */
const ensureActivityRecord = async (userId: string, type: 'vote' | 'comment' | 'post', caseId: string, activityId: string, extraData?: any) => {
  const db = getDb();
  // 넘겨받은 activityId를 문서 ID로 직접 사용하여 중복 생성을 원천 차단합니다.
  const activityRef = db.collection('users').doc(userId).collection('activities').doc(activityId);

  const doc = await activityRef.get();
  if (!doc.exists) {
    functions.logger.info(`[UserStats] 활동 기록 대리 생성: ${userId}, type: ${type}, id: ${activityId}`);
    await activityRef.set({
      type,
      caseId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ...extraData
    });
  }
};

export const onVoteCreate = functions.region('asia-northeast3').firestore.document('cases/{caseId}/votes/{voteId}').onCreate(async (snapshot, context) => {
  const userId = context.params.voteId;
  const caseId = context.params.caseId;
  await syncCaseCounts(caseId);
  // 투표는 유저당 1회이므로 caseId를 고유 활동 ID로 사용
  await ensureActivityRecord(userId, 'vote', caseId, caseId, { vote: snapshot.data()?.vote });
});

export const onVoteDelete = functions.region('asia-northeast3').firestore.document('cases/{caseId}/votes/{voteId}').onDelete(async (snapshot, context) => {
  const userId = context.params.voteId;
  const caseId = context.params.caseId;
  await syncCaseCounts(caseId);
  await admin.firestore().collection('users').doc(userId).collection('activities').doc(caseId).delete();
});

export const onCommentCreate = functions.region('asia-northeast3').firestore.document('cases/{caseId}/comments/{commentId}').onCreate(async (snapshot, context) => {
  const authorId = snapshot.data()?.authorId;
  const caseId = context.params.caseId;
  const commentId = context.params.commentId;
  await syncCaseCounts(caseId);
  // 댓글 ID를 활동 ID로 똑같이 사용하여 신버전 앱의 기록과 충돌(중복) 방지
  if (authorId) await ensureActivityRecord(authorId, 'comment', caseId, commentId, { commentId });
});

export const onCommentDelete = functions.region('asia-northeast3').firestore.document('cases/{caseId}/comments/{commentId}').onDelete(async (snapshot, context) => {
  await syncCaseCounts(context.params.caseId);
});

export const onCommentUpdate = functions.region('asia-northeast3').firestore.document('cases/{caseId}/comments/{commentId}').onUpdate(async (change, context) => {
  const newData = change.after.data();
  const oldData = change.before.data();
  if (oldData.isDeleted !== newData.isDeleted) {
    await syncCaseCounts(context.params.caseId);
  }
});

export const onReplyCreate = functions.region('asia-northeast3').firestore.document('cases/{caseId}/comments/{commentId}/replies/{replyId}').onCreate(async (snapshot, context) => {
  const authorId = snapshot.data()?.authorId;
  const caseId = context.params.caseId;
  const replyId = context.params.replyId;
  await syncCaseCounts(caseId);
  // 대댓글 ID를 활동 ID로 똑같이 사용
  if (authorId) await ensureActivityRecord(authorId, 'comment', caseId, replyId, { commentId: context.params.commentId, replyId });
});

export const onReplyDelete = functions.region('asia-northeast3').firestore.document('cases/{caseId}/comments/{commentId}/replies/{replyId}').onDelete(async (snapshot, context) => {
  await syncCaseCounts(context.params.caseId);
});

/**
 * [관리용] 기존 데이터 마이그레이션 시 생성된 activities의 날짜를 
 * 실제 원본 투표/댓글 생성 시간으로 보정합니다.
 */
export const fixActivitiesTimestamp = functions.region('asia-northeast3').https.onCall(async (data, context) => {
  const db = admin.firestore();
  const activitiesSnap = await db.collectionGroup('activities').get();
  
  let fixedCount = 0;
  
  for (const docSnap of activitiesSnap.docs) {
    const activityData = docSnap.data();
    const { type, caseId, createdAt } = activityData;
    const userId = docSnap.ref.parent.parent?.id;
    
    if (!userId || !caseId) continue;

    let originalDoc: admin.firestore.DocumentSnapshot | null = null;
    
    if (type === 'vote') {
      originalDoc = await db.collection('cases').doc(caseId).collection('votes').doc(userId).get();
    } else if (type === 'comment') {
      originalDoc = await db.collection('cases').doc(caseId).collection('comments').doc(docSnap.id).get();
    } else if (type === 'post') {
      originalDoc = await db.collection('cases').doc(caseId).get();
    }

    if (originalDoc && originalDoc.exists) {
      const originalCreatedAt = originalDoc.data()?.createdAt;
      if (originalCreatedAt) {
        if (!createdAt || !createdAt.isEqual(originalCreatedAt)) {
          await docSnap.ref.update({ createdAt: originalCreatedAt });
          fixedCount++;
        }
      }
    }
  }

  return { success: true, fixedCount };
});