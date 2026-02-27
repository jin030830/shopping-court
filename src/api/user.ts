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
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { User as FirebaseUser } from 'firebase/auth'
import { db, app } from './firebase'

const functions = getFunctions(app, 'asia-northeast3');

/**
 * 사용자 누적 활동 통계 (무제한 보상 미션용)
 */
export interface CumulativeStats {
  voteCount: number;
  commentCount: number;
  postCount: number;
  voteClaimedCount: number;
  commentClaimedCount: number;
  postClaimedCount: number;
}

/**
 * 사용자 일일 활동 통계 (하위 호환 및 기타 목적용 보존)
 */
export interface UserDailyStats {
  lastActiveDate: string; // YYYY-MM-DD
  voteCount: number;
  commentCount: number;
  postCount: number;
  isLevel1Claimed: boolean;
  isLevel2Claimed: boolean;
}

/**
 * 미션 상태 타입
 */
export interface MissionStatus {
  claimed: boolean;
  lastClaimedDate?: string;
}

export interface UserMissions {
  firstEventMission: MissionStatus;
  voteMission: MissionStatus;
  commentMission: MissionStatus;
  hotCaseMission: MissionStatus;
}

/**
 * Firestore 사용자 문서 타입
 */
export interface UserDocument {
  tossUserKey: string
  nickname: string
  dailyStats: UserDailyStats
  stats?: CumulativeStats
  isLevel0Claimed: boolean
  missions: UserMissions
  points: number
  totalExchangedPoints: number
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export function getTodayDateString(): string {
  const now = new Date();
  const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kstDate.toISOString().split('T')[0];
}

function generateRandomDigits(): string {
  return Math.floor(10000 + Math.random() * 90000).toString()
}

async function generateUniqueNickname(
  baseNickname: string = '배심원',
  maxRetries: number = 5
): Promise<string> {
  if (!db) throw new Error('Firestore가 초기화되지 않았습니다.')
  let nickname = `${baseNickname}${generateRandomDigits()}`
  let attempts = 0
  while (attempts < maxRetries) {
    const nicknameQuery = query(collection(db, 'users'), where('nickname', '==', nickname))
    const snapshot = await getDocs(nicknameQuery)
    if (snapshot.empty) return nickname
    attempts++
    nickname = `${baseNickname}${generateRandomDigits()}`
  }
  return `${baseNickname}${Date.now()}`
}

export async function createOrUpdateUser(
  firebaseUser: FirebaseUser,
): Promise<UserDocument> {
  if (!db) throw new Error('Firestore가 초기화되지 않았습니다.')

  const userRef = doc(db, 'users', firebaseUser.uid)
  const today = getTodayDateString();

  try {
    const userSnap = await getDoc(userRef)

    if (userSnap.exists()) {
      const existingData = userSnap.data() as any;
      const updates: any = { updatedAt: serverTimestamp() };

      // 마이그레이션: 기존에 stats가 없으면 초기화
      if (!existingData.stats) {
        updates.stats = {
          voteCount: existingData.dailyStats?.voteCount || 0,
          commentCount: existingData.dailyStats?.commentCount || 0,
          postCount: existingData.dailyStats?.postCount || 0,
          voteClaimedCount: 0,
          commentClaimedCount: 0,
          postClaimedCount: 0,
        };
      }

      // 일일 접속 기록만 갱신 (미션 진행도는 초기화하지 않음)
      if (!existingData.dailyStats || existingData.dailyStats.lastActiveDate !== today) {
        updates.dailyStats = {
          ...(existingData.dailyStats || {}),
          lastActiveDate: today
        };
      }

      if (existingData.isLevel0Claimed === undefined) {
        updates.isLevel0Claimed = existingData.missions?.firstEventMission?.claimed || false;
      }

      await setDoc(userRef, updates, { merge: true });
      const finalDoc = await getDoc(userRef);
      return finalDoc.data() as UserDocument;
    } else {
      const nickname = await generateUniqueNickname()
      const newUser: UserDocument = {
        tossUserKey: firebaseUser.uid,
        nickname,
        dailyStats: { voteCount: 0, commentCount: 0, postCount: 0, isLevel1Claimed: false, isLevel2Claimed: false, lastActiveDate: today },
        stats: { voteCount: 0, commentCount: 0, postCount: 0, voteClaimedCount: 0, commentClaimedCount: 0, postClaimedCount: 0 },
        isLevel0Claimed: false,
        missions: {
          firstEventMission: { claimed: false },
          voteMission: { claimed: false },
          commentMission: { claimed: false },
          hotCaseMission: { claimed: false }
        },
        points: 0,
        totalExchangedPoints: 0,
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any
      };
      await setDoc(userRef, newUser);
      const finalDoc = await getDoc(userRef);
      return finalDoc.data() as UserDocument;
    }
  } catch (error) {
    console.error('사용자 문서 저장 실패:', error)
    throw new Error('사용자 정보 저장에 실패했습니다.')
  }
}

export async function getUserData(firebaseUser: FirebaseUser): Promise<UserDocument | null> {
  if (!db) throw new Error('Firestore가 초기화되지 않았습니다.')
  const userRef = doc(db, 'users', firebaseUser.uid)
  const userSnap = await getDoc(userRef)
  return userSnap.exists() ? (userSnap.data() as UserDocument) : null;
}

export async function claimMissionReward(_userId: string, missionType: string, _rewardPoints: number): Promise<void> {
  const claimMissionRewardFn = httpsCallable<{ missionType: string }, { success: boolean }>(functions, 'claimMissionReward');
  await claimMissionRewardFn({ missionType });
}

export async function warmUpClaimMissionReward(): Promise<void> {
  try {
    const claimMissionRewardFn = httpsCallable<{ missionType: string; isWarmUp: boolean }, { success: boolean }>(functions, 'claimMissionReward');
    await claimMissionRewardFn({ missionType: '', isWarmUp: true });
    console.log('Claim mission function warmed up');
  } catch (error) {
    console.warn('Mission warm-up failed:', error);
  }
}

export async function exchangeGavel(): Promise<void> {
  const PROMOTION_CODE = '01KGA79JNAY2T8AWYCM9869TKS';
  const requestPromotionReward = httpsCallable<{ promotionCode: string }, { success: boolean }>(functions, 'requestPromotionReward');
  const result = await requestPromotionReward({ promotionCode: PROMOTION_CODE });
  if (!result.data.success) throw new Error("토스 포인트 지급에 실패했습니다.");
}

export async function warmUpExchangeGavel(): Promise<void> {
  try {
    const requestPromotionReward = httpsCallable<{ promotionCode: string; isWarmUp: boolean }, { success: boolean }>(functions, 'requestPromotionReward');
    // 실제 포인트 지급이 일어나지 않도록 isWarmUp 플래그를 보냄
    await requestPromotionReward({ promotionCode: '', isWarmUp: true });
    console.log('Exchange function warmed up');
  } catch (error) {
    // Warm-up 실패는 무시 (핵심 로직이 아님)
    console.warn('Warm-up failed:', error);
  }
}