import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  increment,
  runTransaction,
} from 'firebase/firestore'
import type { User as FirebaseUser } from 'firebase/auth'
import { db } from './firebase'

/**
 * 사용자 활동 통계 타입 (일일 미션용)
 */
export interface UserStats {
  voteCount: number;
  commentCount: number;
  postCount: number;
  hotCaseCount: number;
  lastActiveDate: string; // YYYY-MM-DD 형식
}

/**
 * 미션 상태 타입
 */
export interface MissionStatus {
  claimed: boolean; // 금일 보상 수령 여부
  lastClaimedDate?: string; // 마지막으로 보상받은 날짜 (YYYY-MM-DD)
}

export interface UserMissions {
  firstEventMission: MissionStatus; // Level 0: 투표 1개 + 댓글 1개 + 게시물 1개 (계정당 1회)
  voteMission: MissionStatus; // Level 1: 투표 5개 (하루 1번)
  commentMission: MissionStatus; // Level 2: 댓글 3개 (하루 1번)
  hotCaseMission: MissionStatus; // Level 3: 화제의 재판 기록 등재 (게시물당 1번)
}

/**
 * Firestore 사용자 문서 타입
 */
export interface UserDocument {
  tossUserKey: string
  nickname: string
  stats: UserStats
  missions: UserMissions
  points: number // 보유 포인트
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

/**
 * 오늘 날짜 문자열 반환 (KST 기준)
 */
export function getTodayDateString(): string {
  const now = new Date();
  // 한국 시간대로 변환 (UTC+9)
  const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kstDate.toISOString().split('T')[0];
}

/**
 * 랜덤 5자리 숫자 생성
 */
function generateRandomDigits(): string {
  return Math.floor(10000 + Math.random() * 90000).toString()
}

/**
 * 고유한 닉네임 생성
 */
async function generateUniqueNickname(
  baseNickname: string = '배심원',
  maxRetries: number = 5
): Promise<string> {
  let nickname = `${baseNickname}${generateRandomDigits()}`
  let attempts = 0

  while (attempts < maxRetries) {
    if (!db) {
      throw new Error('Firestore가 초기화되지 않았습니다.')
    }

    const nicknameQuery = query(
      collection(db, 'users'),
      where('nickname', '==', nickname)
    )
    const snapshot = await getDocs(nicknameQuery)

    if (snapshot.empty) {
      return nickname
    }

    attempts++
    nickname = `${baseNickname}${generateRandomDigits()}`
  }

  // 최대 재시도 후에도 실패하면 타임스탬프 추가
  return `${baseNickname}${Date.now()}`
}

/**
 * Firestore에 사용자 문서 생성/업데이트
 */
export async function createOrUpdateUser(
  firebaseUser: FirebaseUser,
): Promise<UserDocument> {
  if (!db) {
    throw new Error('Firestore가 초기화되지 않았습니다.')
  }

  const userRef = doc(db, 'users', firebaseUser.uid)
  const today = getTodayDateString();

  try {
    const userSnap = await getDoc(userRef)

    if (userSnap.exists()) {
      const existingData = userSnap.data() as UserDocument;
      const updates: any = { updatedAt: serverTimestamp() };
      
      // stats 필드가 없거나 날짜가 다르면 초기화
      if (!existingData.stats || existingData.stats.lastActiveDate !== today) {
        updates.stats = { 
          voteCount: 0, 
          commentCount: 0, 
          postCount: 0, 
          hotCaseCount: 0,
          lastActiveDate: today 
        };
        existingData.stats = updates.stats;
        
        // 날짜가 바뀌었으므로 미션 상태도 초기화 (화면 표시용)
        // 단, firstEventMission은 계정당 1회이므로 초기화하지 않음
        const existingFirstEvent = existingData.missions?.firstEventMission || { claimed: false, lastClaimedDate: '' };
        updates.missions = {
          firstEventMission: existingFirstEvent,
          voteMission: { claimed: false, lastClaimedDate: '' },
          commentMission: { claimed: false, lastClaimedDate: '' },
          hotCaseMission: { claimed: false, lastClaimedDate: '' }
        };
        existingData.missions = updates.missions;
      }
      
      // missions 필드가 아예 없는 경우 초기화
      if (!existingData.missions) {
        updates.missions = {
          firstEventMission: { claimed: false },
          voteMission: { claimed: false },
          commentMission: { claimed: false },
          hotCaseMission: { claimed: false }
        };
        existingData.missions = updates.missions;
      }

      if (existingData.points === undefined) {
        updates.points = 0;
        existingData.points = 0;
      }

      await setDoc(userRef, updates, { merge: true });

      return {
        ...existingData,
        updatedAt: Timestamp.now()
      };
    } else {
      // 신규 유저
      const nickname = await generateUniqueNickname()
      const newUserDocument: Omit<UserDocument, 'createdAt' | 'updatedAt'> & { createdAt: any, updatedAt: any } = {
        tossUserKey: firebaseUser.uid,
        nickname,
        stats: {
          voteCount: 0,
          commentCount: 0,
          postCount: 0,
          hotCaseCount: 0,
          lastActiveDate: today
        },
        missions: {
          firstEventMission: { claimed: false, lastClaimedDate: '' },
          voteMission: { claimed: false, lastClaimedDate: '' },
          commentMission: { claimed: false, lastClaimedDate: '' },
          hotCaseMission: { claimed: false, lastClaimedDate: '' }
        },
        points: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      await setDoc(userRef, newUserDocument);
      
      return {
        ...newUserDocument,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      } as UserDocument;
    }
  } catch (error) {
    console.error('사용자 문서 생성/업데이트 실패:', error)
    throw new Error('사용자 정보 저장에 실패했습니다.')
  }
}

/**
 * 현재 사용자 정보 조회
 */
export async function getUserData(
  firebaseUser: FirebaseUser
): Promise<UserDocument | null> {
  if (!db) {
    throw new Error('Firestore가 초기화되지 않았습니다.')
  }

  try {
    const userRef = doc(db, 'users', firebaseUser.uid)
    const userSnap = await getDoc(userRef)

    if (userSnap.exists()) {
      return userSnap.data() as UserDocument
    }

    return null
  } catch (error) {
    console.error('사용자 정보 조회 실패:', error)
    return null
  }
}

/**
 * 미션 보상 수령 처리
 */
export async function claimMissionReward(userId: string, missionType: keyof UserMissions, rewardPoints: number): Promise<void> {
  if (!db) throw new Error('Firestore가 초기화되지 않았습니다.');
  
  const userRef = doc(db, 'users', userId);
  const today = getTodayDateString();
  
  await runTransaction(db, async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) throw new Error("User not found");
    
    const userData = userDoc.data() as UserDocument;
    const mission = userData.missions?.[missionType];

    // firstEventMission은 계정당 1회만 가능
    if (missionType === 'firstEventMission' && mission?.claimed) {
      throw new Error("이미 보상을 수령했습니다.");
    }

    // 다른 미션들은 오늘 날짜로 보상을 받았다면 에러 처리
    if (missionType !== 'firstEventMission' && mission?.claimed && mission?.lastClaimedDate === today) {
      throw new Error("이미 보상을 수령했습니다.");
    }

    // 날짜가 다르면(어제 받은 것) claimed가 true여도 새로 받을 수 있음 -> 로직상 덮어쓰기
    transaction.update(userRef, {
      [`missions.${missionType}`]: {
        claimed: true,
        lastClaimedDate: today
      },
      points: increment(rewardPoints)
    });
  });
}

/**
 * 판사봉 교환 처리 (판사봉 50개 -> 5P)
 */
export async function exchangeGavel(userId: string): Promise<void> {
  if (!db) throw new Error('Firestore가 초기화되지 않았습니다.');
  
  const userRef = doc(db, 'users', userId);
  const GAVEL_EXCHANGE_RATE = 50; // 판사봉 50개
  const POINTS_PER_EXCHANGE = 5; // 5P
  
  await runTransaction(db, async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) throw new Error("User not found");
    
    const userData = userDoc.data() as UserDocument;
    const currentGavel = userData.points || 0;

    if (currentGavel < GAVEL_EXCHANGE_RATE) {
      throw new Error("판사봉이 부족합니다.");
    }

    transaction.update(userRef, {
      points: increment(-GAVEL_EXCHANGE_RATE + POINTS_PER_EXCHANGE)
    });
  });
}