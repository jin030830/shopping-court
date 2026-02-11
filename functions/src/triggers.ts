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
  // 공통 KST 날짜 헬퍼 사용
  const today = getTodayDateString();

  try {
    let actualCount = -1;

    // 1. 신버전 앱 대응: activities 컬렉션 조회
    if (!forceIncrement) {
      const activitiesCollection = userRef.collection('activities');
      
      // KST 기준 오늘 00:00:00의 UTC Timestamp 계산
      const kstTodayStart = new Date(today + "T00:00:00+09:00");
      const startOfTodayTimestamp = admin.firestore.Timestamp.fromDate(kstTodayStart);

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
  // 게시물 투표수 즉시 동기화
  await syncCaseCounts(context.params.caseId);
});

export const onVoteDelete = functions.region('asia-northeast3').firestore.document('cases/{caseId}/votes/{voteId}').onDelete(async (snapshot, context) => {
  await syncCaseCounts(context.params.caseId);
});

export const onCommentCreate = functions.region('asia-northeast3').firestore.document('cases/{caseId}/comments/{commentId}').onCreate(async (snapshot, context) => {
  await syncCaseCounts(context.params.caseId);
});

export const onCommentDelete = functions.region('asia-northeast3').firestore.document('cases/{caseId}/comments/{commentId}').onDelete(async (snapshot, context) => {
  await syncCaseCounts(context.params.caseId);
});

export const onCommentUpdate = functions.region('asia-northeast3').firestore.document('cases/{caseId}/comments/{commentId}').onUpdate(async (change, context) => {
  const newData = change.after.data();
  const oldData = change.before.data();

  // 삭제 상태 변경 시 게시물 수치 재동기화 (Soft Delete 대응)
  if (oldData.isDeleted !== newData.isDeleted) {
    await syncCaseCounts(context.params.caseId);
  }
});

export const onReplyCreate = functions.region('asia-northeast3').firestore.document('cases/{caseId}/comments/{commentId}/replies/{replyId}').onCreate(async (snapshot, context) => {
  await syncCaseCounts(context.params.caseId);
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