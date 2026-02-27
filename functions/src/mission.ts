import * as functions from 'firebase-functions/v1';
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

// Removed getTodayDateString as it is no longer used

/**
 * 사용자 통계 확인 및 초기화 함수 (Lazy Initialization)
 * 트랜잭션 내에서 호출되어야 함
 */
const getOrCreateStats = (userData: any): any => {
  const stats = userData?.stats || {
    voteCount: 0,
    commentCount: 0,
    postCount: 0,
    voteClaimedCount: 0,
    commentClaimedCount: 0,
    postClaimedCount: 0,
  };

  // 마이그레이션 방어 코드: 기존 `dailyStats` 값을 누적 스탯의 초기값으로 가져오거나, 없으면 0
  if (userData?.dailyStats && stats.voteCount === 0 && stats.commentCount === 0 && stats.postCount === 0) {
    stats.voteCount = userData.dailyStats.voteCount || 0;
    stats.commentCount = userData.dailyStats.commentCount || 0;
    stats.postCount = userData.dailyStats.postCount || 0;
  }

  // 기존에 ClaimedCount 필드가 없다면 0으로 초기화
  stats.voteClaimedCount = stats.voteClaimedCount || 0;
  stats.commentClaimedCount = stats.commentClaimedCount || 0;
  stats.postClaimedCount = stats.postClaimedCount || 0;

  return stats;
};

/**
 * 미션 보상 수령 Callable Function
 */
export const claimMissionReward = functions.region('asia-northeast3')
  .https.onCall(async (data: { missionType: string; isWarmUp?: boolean }, context: functions.https.CallableContext) => {
    // 0. Warm-up 요청 처리
    if (data.isWarmUp) {
      console.log(`[Warm-up] claimMissionReward instance warmed up.`);
      return { success: true, message: "warmed up" };
    }

    // 1. 인증 확인
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const userId = context.auth.uid;
    const missionType = data.missionType; // 'LEVEL_0', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3'

    if (!['LEVEL_0', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3'].includes(missionType)) {
      throw new functions.https.HttpsError('invalid-argument', '유효하지 않은 미션 타입입니다.');
    }

    const db = getDb();
    const userRef = db.collection('users').doc(userId);

    try {
      await db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new functions.https.HttpsError('not-found', '사용자 정보를 찾을 수 없습니다.');
        }

        const userData = userDoc.data();

        // 2. 누적 통계 초기화 체크
        const currentStats = getOrCreateStats(userData);

        // 3. 미션 달성 여부 및 남은 횟수(remainCount) 계산
        let rewardPoints = 0;
        let updateField = '';
        let remainCount = 0;

        if (missionType === 'LEVEL_1') {
          // 과거 LEVEL_1: 투표 1회당 보상 1번
          const totalEarned = Math.floor(currentStats.voteCount / 1);
          remainCount = totalEarned - currentStats.voteClaimedCount;

          rewardPoints = 50;
          updateField = 'stats.voteClaimedCount';
        } else if (missionType === 'LEVEL_2') {
          // 과거 LEVEL_2: 댓글 1회당 보상 1번
          const totalEarned = Math.floor(currentStats.commentCount / 1);
          remainCount = totalEarned - currentStats.commentClaimedCount;

          rewardPoints = 50;
          updateField = 'stats.commentClaimedCount';
        } else if (missionType === 'LEVEL_0') {
          // 과거 LEVEL_0: 게시물 1회당 보상 1번
          const totalEarned = Math.floor(currentStats.postCount / 1);
          remainCount = totalEarned - currentStats.postClaimedCount;

          rewardPoints = 100;
          updateField = 'stats.postClaimedCount';
        } else if (missionType === 'LEVEL_3') {
          // Level 3: 화제의 재판 등재 (게시물당 1회 보상)
          const potentialCases = await db.collection('cases')
            .where('authorId', '==', userId)
            .get();

          const targetCase = potentialCases.docs.find(doc => {
            const d = doc.data();
            return d.status === 'CLOSED' && (d.hotScore || 0) > 0 && d.isHotListed !== true;
          });

          if (!targetCase) {
            throw new functions.https.HttpsError('failed-precondition', '보상 받을 수 있는 새로운 화제의 재판 기록이 없습니다.');
          }

          rewardPoints = 100;
          remainCount = 1; // 특수 미션은 남은 횟수 1로 취급하여 통과
          transaction.update(targetCase.ref, { isHotListed: true });
          updateField = '';
        }

        if (remainCount <= 0) {
          throw new functions.https.HttpsError('failed-precondition', '미션 조건을 달성하지 못했거나, 이미 모든 보상을 수령했습니다.');
        }

        // 4. 보상 지급 및 상태 업데이트 (트랜잭션 안전 보장)
        const updates: any = {
          points: admin.firestore.FieldValue.increment(rewardPoints)
        };

        if (updateField === 'stats.voteClaimedCount') {
          updates['stats.voteClaimedCount'] = admin.firestore.FieldValue.increment(1);
          updates['dailyStats.isLevel1Claimed'] = true; // 구버전 호환 (LEVEL_1 = 투표) - 참고: 과거 LEVEL_1이 투표였음
        } else if (updateField === 'stats.commentClaimedCount') {
          updates['stats.commentClaimedCount'] = admin.firestore.FieldValue.increment(1);
          updates['dailyStats.isLevel2Claimed'] = true; // 구버전 호환 (LEVEL_2 = 댓글)
        } else if (updateField === 'stats.postClaimedCount') {
          updates['stats.postClaimedCount'] = admin.firestore.FieldValue.increment(1);
          updates.isLevel0Claimed = true; // 구버전 호환 (LEVEL_0 = 사건접수)
        }

        // 전체 할당 대신 dot notation을 쓰도록 stats 갱신 방식 변경
        updates['stats.voteCount'] = currentStats.voteCount;
        updates['stats.commentCount'] = currentStats.commentCount;
        updates['stats.postCount'] = currentStats.postCount;

        transaction.update(userRef, updates);

        // 5. 포인트 이력 기록 (Transaction 내에서 수행)
        const historyRef = db.collection('point_history').doc();
        transaction.set(historyRef, {
          userId,
          type: 'EARN',
          amount: rewardPoints,
          reason: `MISSION_REWARD_${missionType}`,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      return { success: true, message: '보상이 지급되었습니다.' };

    } catch (error) {
      console.error('[ClaimReward Error]', error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', '보상 지급 중 오류가 발생했습니다.');
    }
  });
