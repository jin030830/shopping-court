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
 * 사용자 통계(일일) 확인 및 초기화 함수 (Lazy Initialization)
 * 트랜잭션 내에서 호출되어야 함
 */
const checkAndResetDailyStats = (userData: any, today: string): any => {
  const stats = userData?.dailyStats || {};
  const lastActiveDate = stats.lastActiveDate;

  if (lastActiveDate !== today) {
    return {
      lastActiveDate: today,
      voteCount: 0,
      commentCount: 0,
      postCount: 0,
      isLevel1Claimed: false,
      isLevel2Claimed: false
    };
  }
  return stats;
};

/**
 * 미션 보상 수령 Callable Function
 */
export const claimMissionReward = functions.region('asia-northeast3')
  .https.onCall(async (data: { missionType: string; isWarmUp?: boolean }, context) => {
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
    const today = getTodayDateString();

    try {
      await db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new functions.https.HttpsError('not-found', '사용자 정보를 찾을 수 없습니다.');
        }

        const userData = userDoc.data();
        
        // 2. 일일 통계 초기화 체크
        const currentDailyStats = checkAndResetDailyStats(userData, today);
        
        // 3. 미션 달성 여부 및 중복 수령 확인
        let rewardPoints = 0;
        let isConditionMet = false;
        let isAlreadyClaimed = false;
        let updateField = '';

        if (missionType === 'LEVEL_0') {
          // Level 0: 일일(dailyStats) - 투표 1, 댓글 1, 게시글 1 (v1.7)
          isConditionMet = currentDailyStats.voteCount >= 1 && currentDailyStats.commentCount >= 1 && currentDailyStats.postCount >= 1;
          isAlreadyClaimed = userData?.isLevel0Claimed === true;
          rewardPoints = 100;
          updateField = 'isLevel0Claimed';
        } else if (missionType === 'LEVEL_1') {
          // Level 1: 일일(dailyStats) - 투표 5
          isConditionMet = currentDailyStats.voteCount >= 5;
          isAlreadyClaimed = currentDailyStats.isLevel1Claimed === true;
          rewardPoints = 30;
          updateField = 'dailyStats.isLevel1Claimed';
        } else if (missionType === 'LEVEL_2') {
          // Level 2: 일일(dailyStats) - 댓글 3
          isConditionMet = currentDailyStats.commentCount >= 3;
          isAlreadyClaimed = currentDailyStats.isLevel2Claimed === true;
          rewardPoints = 60;
          updateField = 'dailyStats.isLevel2Claimed';
        } else if (missionType === 'LEVEL_3') {
          // Level 3: 화제의 재판 등재 (게시물당 1회 보상)
          // [Optimization] 모든 글을 읽지 않고, 조건에 맞는 단 하나의 글만 쿼리로 찾음 (Read 비용 절감)
          const hotCaseQuery = await db.collection('cases')
            .where('authorId', '==', userId)
            .where('status', '==', 'CLOSED')
            .where('hotScore', '>', 0)
            .where('isHotListed', '==', false)
            .limit(1)
            .get();

          if (hotCaseQuery.empty) {
            throw new functions.https.HttpsError('failed-precondition', '보상 받을 수 있는 새로운 화제의 재판 기록이 없습니다.');
          }

          const targetCase = hotCaseQuery.docs[0];
          rewardPoints = 100;
          
          // 해당 게시물에 보상 완료 표시 (트랜잭션 내에서 처리)
          transaction.update(targetCase.ref, { isHotListed: true });
          
          // 유저 업데이트용 필드
          updateField = ''; 
        }

        if (missionType !== 'LEVEL_3' && !isConditionMet) {
          throw new functions.https.HttpsError('failed-precondition', '미션 조건을 달성하지 못했습니다.');
        }

        if (missionType !== 'LEVEL_3' && isAlreadyClaimed) {
          throw new functions.https.HttpsError('already-exists', '이미 보상을 수령했습니다.');
        }

        // 4. 보상 지급 및 상태 업데이트
        const updates: any = {
          points: admin.firestore.FieldValue.increment(rewardPoints),
        };
        
        if (updateField) {
          updates[updateField] = true;
        }

        // 날짜가 바뀌어서 초기화된 경우 dailyStats 전체 업데이트
        if (userData?.dailyStats?.lastActiveDate !== today) {
          updates['dailyStats'] = currentDailyStats;
          // 방금 수령한 플래그 다시 true로 설정 (초기화 객체에는 false로 되어있음)
          if (missionType === 'LEVEL_1') updates['dailyStats'].isLevel1Claimed = true;
          if (missionType === 'LEVEL_2') updates['dailyStats'].isLevel2Claimed = true;
        }

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
