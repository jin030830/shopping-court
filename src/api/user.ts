import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  runTransaction,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore'
import type { User as FirebaseUser } from 'firebase/auth'
import { db } from './firebase'

/**
 * Firestore 사용자 문서 타입
 */
export interface UserDocument {
  tossUserKey: string
  nickname: string
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

/**
 * 랜덤 4자리 숫자 생성
 */
function generateRandomDigits(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

/**
 * 고유한 닉네임 생성
 */
async function generateUniqueNickname(
  baseNickname: string = '익명',
  maxRetries: number = 5
): Promise<string> {
  let nickname = `${baseNickname}${generateRandomDigits()}`
  let attempts = 0

  while (attempts < maxRetries) {
    if (!db) {
      throw new Error('Firestore가 초기화되지 않았습니다.')
    }

    // 중복 체크
    const nicknameQuery = query(
      collection(db, 'users'),
      where('nickname', '==', nickname)
    )
    const snapshot = await getDocs(nicknameQuery)

    if (snapshot.empty) {
      // 중복 없음, 사용 가능
      return nickname
    }

    // 중복 발견, 숫자 추가 후 재시도
    attempts++
    if (attempts < maxRetries) {
      nickname = `${baseNickname}${generateRandomDigits()}_${attempts}`
    } else {
      // 최대 재시도 횟수 초과, 타임스탬프 추가
      nickname = `${baseNickname}${generateRandomDigits()}_${Date.now()}`
    }
  }

  return nickname
}

/**
 * Firestore에 사용자 문서 생성/업데이트
 * 트랜잭션을 사용하여 안전하게 처리
 */
export async function createOrUpdateUser(
  firebaseUser: FirebaseUser,
  tossUserKey: string
): Promise<UserDocument> {
  if (!db) {
    throw new Error('Firestore가 초기화되지 않았습니다.')
  }

  const userRef = doc(db, 'users', firebaseUser.uid)

  try {
    // 먼저 기존 문서 확인 (트랜잭션 밖에서)
    const userSnap = await getDoc(userRef)
    const existingData = userSnap.data() as UserDocument | undefined

    // 닉네임 생성/확인 (트랜잭션 밖에서)
    let nickname: string
    if (existingData?.nickname) {
      nickname = existingData.nickname
    } else {
      nickname = await generateUniqueNickname()
    }

    // 트랜잭션으로 안전하게 저장
    const userDoc = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userRef)
      const data = snap.data() as UserDocument | undefined

      const createdAt: Timestamp | null = data?.createdAt || (serverTimestamp() as Timestamp | null)

      // tossUserKey가 없으면 업데이트
      const updateData: Partial<UserDocument> = {
        tossUserKey,
        nickname: data?.nickname || nickname,
        updatedAt: serverTimestamp() as Timestamp | null,
      }

      if (!data) {
        updateData.createdAt = createdAt
      }

      transaction.set(userRef, updateData, { merge: true })

      return {
        tossUserKey,
        nickname: updateData.nickname!,
        createdAt,
        updatedAt: updateData.updatedAt,
      } as UserDocument
    })

    return userDoc
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
