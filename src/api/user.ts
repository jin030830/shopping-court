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
 * 사용자가 처음 로그인할 때만 닉네임을 생성합니다.
 */
export async function createOrUpdateUser(
  firebaseUser: FirebaseUser,
): Promise<UserDocument> {
  if (!db) {
    throw new Error('Firestore가 초기화되지 않았습니다.')
  }

  const userRef = doc(db, 'users', firebaseUser.uid)

  try {
    const userSnap = await getDoc(userRef)

    if (userSnap.exists()) {
      // 기존 유저면 정보 반환
      const existingData = userSnap.data() as UserDocument;
      await setDoc(userRef, { updatedAt: serverTimestamp() }, { merge: true });
      return {
        ...existingData,
        updatedAt: Timestamp.now() // 즉각적인 UI 피드백을 위해 클라이언트 시간 사용
      };
    } else {
      // 신규 유저면 닉네임 생성 후 문서 생성
      const nickname = await generateUniqueNickname()
      const newUserDocument = {
        tossUserKey: firebaseUser.uid,
        nickname,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      await setDoc(userRef, newUserDocument);
      
      // 방금 생성한 문서를 반환하되, createdAt/updatedAt은 클라이언트 시간으로 설정하여 반환
      // toDate() 오류를 방지하기 위함
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