import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  Timestamp,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  runTransaction,
  increment
} from 'firebase/firestore';
import { getTodayDateString, type UserDocument } from './user';

// '통합명세서.md'에 정의된 데이터 구조를 기반으로 인터페이스 정의
export interface CaseData {
  title: string;
  content: string;
  authorId: string;
  authorNickname: string; // 명세서에는 없지만, join을 피하기 위해 추가하면 좋음
  images?: string[];
  ageGroup?: string;
  situation?: string;
  job?: string;
  item?: string;
  price?: string;
}

export interface CaseDocument extends CaseData {
  id: string; // 문서 ID를 포함
  guiltyCount: number;
  innocentCount: number;
  commentCount: number;
  voteEndAt: Timestamp;
  status: 'OPEN' | 'CLOSED';
  hotScore: number;
  createdAt: Timestamp;
}

export type VoteType = 'guilty' | 'innocent';

export interface CommentData {
  authorId: string;
  authorNickname: string;
  content: string;
  vote: VoteType;
}

export interface CommentDocument extends CommentData {
  id: string;
  createdAt: Timestamp;
  likes?: number;
}

export interface ReplyData {
  authorId: string;
  authorNickname: string;
  content: string;
  vote: VoteType;
}

export interface ReplyDocument extends ReplyData {
  id: string;
  createdAt: Timestamp;
  likes?: number;
}

/**
 * 모든 '고민'을 Firestore에서 조회합니다.
 * @returns 모든 고민 문서의 배열
 */
export const getAllCases = async (): Promise<CaseDocument[]> => {
  if (!db) {
    throw new Error('Firebase가 초기화되지 않았습니다.');
  }
  try {
    const casesCollection = collection(db, 'cases');
    const q = query(casesCollection, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const cases = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as CaseDocument));
    return cases;
  } catch (error) {
    console.error('❌ 모든 고민 조회 중 오류 발생:', error);
    throw new Error('고민 목록을 불러오는 데 실패했습니다.');
  }
};

/**
 * 새로운 '고민'을 Firestore에 생성합니다.
 * @param caseData - 생성할 고민의 데이터
 * @returns 생성된 문서의 ID
 */
export const createCase = async (caseData: CaseData): Promise<string> => {
  if (!db) {
    throw new Error('Firebase가 초기화되지 않았습니다.');
  }

  try {
    const now = Timestamp.now();
    // 48시간 후의 시간을 voteEndAt으로 설정
    const voteEndTime = new Timestamp(now.seconds + 48 * 60 * 60, now.nanoseconds);

    const docRef = await addDoc(collection(db, 'cases'), {
      ...caseData,
      guiltyCount: 0,
      innocentCount: 0,
      commentCount: 0,
      status: 'OPEN',
      hotScore: 0,
      createdAt: serverTimestamp(), // 서버 시간 기준으로 생성
      voteEndAt: voteEndTime,
    });

    // 사용자 stats.postCount 업데이트 (일일 미션 로직 포함)
    const userRef = doc(db, 'users', caseData.authorId);
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) return;

      const userData = userDoc.data() as UserDocument;
      const today = getTodayDateString();
      const lastActiveDate = userData.stats?.lastActiveDate;

      if (lastActiveDate !== today) {
        transaction.update(userRef, {
          'stats.postCount': 1,
          'stats.voteCount': 0,
          'stats.commentCount': 0,
          'stats.hotCaseCount': 0,
          'stats.lastActiveDate': today,
          'missions.voteMission': { claimed: false, lastClaimedDate: '' },
          'missions.commentMission': { claimed: false, lastClaimedDate: '' },
          'missions.postMission': { claimed: false, lastClaimedDate: '' },
          'missions.hotCaseMission': { claimed: false, lastClaimedDate: '' },
        });
      } else {
        transaction.update(userRef, { 'stats.postCount': increment(1) });
      }
    });

    console.log('✅ 새로운 고민이 성공적으로 생성되었습니다. ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ 고민 생성 중 오류 발생:', error);
    throw new Error('고민을 생성하는 데 실패했습니다.');
  }
};

/**
 * 특정 '고민'을 Firestore에서 조회합니다.
 * @param caseId - 조회할 고민의 문서 ID
 * @returns 조회된 문서 데이터 또는 null
 */
export const getCase = async (caseId: string): Promise<CaseDocument | null> => {
  if (!db) {
    throw new Error('Firebase가 초기화되지 않았습니다.');
  }
  try {
    const docRef = doc(db, 'cases', caseId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as CaseDocument;
    } else {
      console.log('해당 ID의 문서를 찾을 수 없습니다.');
      return null;
    }
  } catch (error) {
    console.error('❌ 고민 조회 중 오류 발생:', error);
    throw new Error('고민을 조회하는 데 실패했습니다.');
  }
};

/**
 * 기존 '고민'을 Firestore에서 업데이트합니다.
 * @param caseId - 업데이트할 고민의 문서 ID
 * @param caseData - 업데이트할 데이터 (title, content 등)
 */
export const updateCase = async (caseId: string, caseData: Partial<CaseData>): Promise<void> => {
  if (!db) {
    throw new Error('Firebase가 초기화되지 않았습니다.');
  }
  try {
    const docRef = doc(db, 'cases', caseId);
    await updateDoc(docRef, {
      ...caseData,
      updatedAt: serverTimestamp() // 수정 시간 기록
    });
    console.log('✅ 고민이 성공적으로 업데이트되었습니다. ID:', caseId);
  } catch (error) {
    console.error('❌ 고민 업데이트 중 오류 발생:', error);
    throw new Error('고민을 업데이트하는 데 실패했습니다.');
  }
};

/**
 * '고민'을 Firestore에서 삭제합니다.
 * @param caseId - 삭제할 고민의 문서 ID
 */
export const deleteCase = async (caseId: string): Promise<void> => {
  if (!db) {
    throw new Error('Firebase가 초기화되지 않았습니다.');
  }
  try {
    const docRef = doc(db, 'cases', caseId);
    await deleteDoc(docRef);
    console.log('✅ 고민이 성공적으로 삭제되었습니다. ID:', caseId);
  } catch (error) {
    console.error('❌ 고민 삭제 중 오류 발생:', error);
    throw new Error('고민을 삭제하는 데 실패했습니다.');
  }
};

/**
 * 사용자가 특정 고민에 투표했는지 확인합니다.
 * @param caseId - 고민 ID
 * @param userId - 사용자 ID
 * @returns 투표 종류 (guilty, innocent) 또는 null
 */
export const getUserVote = async (caseId: string, userId: string): Promise<VoteType | null> => {
  if (!db) throw new Error('Firebase가 초기화되지 않았습니다.');
  const voteDocRef = doc(db, 'cases', caseId, 'votes', userId);
  const voteSnap = await getDoc(voteDocRef);
  if (voteSnap.exists()) {
    return voteSnap.data().vote as VoteType;
  }
  return null;
};

/**
 * 고민에 투표합니다. (트랜잭션)
 * @param caseId - 고민 ID
 * @param userId - 사용자 ID
 * @param vote - 투표 종류 (guilty, innocent)
 */
export const addVote = async (caseId: string, userId: string, vote: VoteType): Promise<void> => {
  if (!db) throw new Error('Firebase가 초기화되지 않았습니다.');
  
  const caseRef = doc(db, 'cases', caseId);
  const voteRef = doc(db, 'cases', caseId, 'votes', userId);
  const userRef = doc(db, 'users', userId); // 사용자 문서 참조

  try {
    await runTransaction(db, async (transaction) => {
      const voteDoc = await transaction.get(voteRef);
      if (voteDoc.exists()) {
        throw new Error('이미 투표했습니다.');
      }

      const caseDoc = await transaction.get(caseRef);
      if (!caseDoc.exists()) {
        throw new Error('존재하지 않는 게시물입니다.');
      }

      // 투표 기록
      transaction.set(voteRef, {
        userId,
        vote,
        createdAt: serverTimestamp(),
      });

      // 투표 수 업데이트
      if (vote === 'guilty') {
        transaction.update(caseRef, { guiltyCount: increment(1) });
      } else {
        transaction.update(caseRef, { innocentCount: increment(1) });
      }

      // 사용자 stats.voteCount 업데이트 (일일 미션 로직 포함)
      const userDoc = await transaction.get(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data() as UserDocument;
        const today = getTodayDateString();
        const lastActiveDate = userData.stats?.lastActiveDate;

        if (lastActiveDate !== today) {
          transaction.update(userRef, {
            'stats.voteCount': 1,
            'stats.commentCount': 0,
            'stats.postCount': 0,
            'stats.hotCaseCount': 0,
            'stats.lastActiveDate': today,
            'missions.voteMission': { claimed: false, lastClaimedDate: '' },
            'missions.commentMission': { claimed: false, lastClaimedDate: '' },
            'missions.postMission': { claimed: false, lastClaimedDate: '' },
            'missions.hotCaseMission': { claimed: false, lastClaimedDate: '' },
          });
        } else {
          transaction.update(userRef, { 'stats.voteCount': increment(1) });
        }
      }
    });
    console.log('✅ 투표가 성공적으로 기록되었습니다.');
  } catch (error) {
    console.error('❌ 투표 처리 중 오류 발생:', error);
    throw error; // UI에서 에러를 처리할 수 있도록 다시 던짐
  }
};

/**
 * 특정 고민에 대한 모든 댓글을 조회합니다.
 * @param caseId - 고민 ID
 * @returns 댓글 문서의 배열
 */
export const getComments = async (caseId: string): Promise<CommentDocument[]> => {
  if (!db) throw new Error('Firebase가 초기화되지 않았습니다.');
  const commentsCollection = collection(db, 'cases', caseId, 'comments');
  const q = query(commentsCollection, orderBy('createdAt', 'asc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as CommentDocument));
};

/**
 * 특정 고민에 새로운 댓글을 추가합니다.
 * @param caseId - 고민 ID
 * @param commentData - 댓글 데이터
 * @returns 생성된 댓글의 ID
 */
export const addComment = async (caseId: string, commentData: CommentData): Promise<string> => {
  if (!db) throw new Error('Firebase가 초기화되지 않았습니다.');
  
  const commentsCollection = collection(db, 'cases', caseId, 'comments');
  const userRef = doc(db, 'users', commentData.authorId);

  // 댓글 추가
  const docRef = await addDoc(commentsCollection, {
    ...commentData,
    likes: 0,
    createdAt: serverTimestamp(),
  });

  // 사용자 stats.commentCount 업데이트 (일일 미션 로직 포함)
  await runTransaction(db, async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) return;

    const userData = userDoc.data() as UserDocument;
    const today = getTodayDateString();
    const lastActiveDate = userData.stats?.lastActiveDate;

    if (lastActiveDate !== today) {
      transaction.update(userRef, {
        'stats.commentCount': 1,
        'stats.voteCount': 0,
        'stats.postCount': 0,
        'stats.hotCaseCount': 0,
        'stats.lastActiveDate': today,
        'missions.voteMission': { claimed: false, lastClaimedDate: '' },
        'missions.commentMission': { claimed: false, lastClaimedDate: '' },
        'missions.postMission': { claimed: false, lastClaimedDate: '' },
        'missions.hotCaseMission': { claimed: false, lastClaimedDate: '' },
      });
    } else {
      transaction.update(userRef, { 'stats.commentCount': increment(1) });
    }
  });

  return docRef.id;
};

/**
 * 댓글에 좋아요를 추가합니다.
 * @param caseId - 고민 ID
 * @param commentId - 댓글 ID
 */
export const addCommentLike = async (caseId: string, commentId: string): Promise<void> => {
  if (!db) throw new Error('Firebase가 초기화되지 않았습니다.');
  const commentRef = doc(db, 'cases', caseId, 'comments', commentId);
  await updateDoc(commentRef, {
    likes: increment(1),
  });
};

/**
 * 답글에 좋아요를 추가합니다.
 * @param caseId - 고민 ID
 * @param commentId - 댓글 ID
 * @param replyId - 답글 ID
 */
export const addReplyLike = async (caseId: string, commentId: string, replyId: string): Promise<void> => {
  if (!db) throw new Error('Firebase가 초기화되지 않았습니다.');
  const replyRef = doc(db, 'cases', caseId, 'comments', commentId, 'replies', replyId);
  await updateDoc(replyRef, {
    likes: increment(1),
  });
};

/**
 * 특정 댓글의 대댓글을 조회합니다.
 * @param caseId - 고민 ID
 * @param commentId - 댓글 ID
 * @returns 대댓글 문서의 배열
 */
export const getReplies = async (caseId: string, commentId: string): Promise<ReplyDocument[]> => {
  if (!db) throw new Error('Firebase가 초기화되지 않았습니다.');
  const repliesCollection = collection(db, 'cases', caseId, 'comments', commentId, 'replies');
  const q = query(repliesCollection, orderBy('createdAt', 'asc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as ReplyDocument));
};

/**
 * 댓글에 대댓글을 추가합니다.
 * @param caseId - 고민 ID
 * @param commentId - 댓글 ID
 * @param replyData - 대댓글 데이터
 * @returns 생성된 대댓글의 ID
 */
export const addReply = async (caseId: string, commentId: string, replyData: ReplyData): Promise<string> => {
  if (!db) throw new Error('Firebase가 초기화되지 않았습니다.');
  
  const repliesCollection = collection(db, 'cases', caseId, 'comments', commentId, 'replies');
  const userRef = doc(db, 'users', replyData.authorId);

  const docRef = await addDoc(repliesCollection, {
    ...replyData,
    likes: 0,
    createdAt: serverTimestamp(),
  });

  // 답글 수 증가 (댓글 수와 동일하게 처리 - 트랜잭션 사용)
  await runTransaction(db, async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) return;

    const userData = userDoc.data() as UserDocument;
    const today = getTodayDateString();
    const lastActiveDate = userData.stats?.lastActiveDate;

    if (lastActiveDate !== today) {
      transaction.update(userRef, {
        'stats.commentCount': 1,
        'stats.voteCount': 0,
        'stats.postCount': 0,
        'stats.hotCaseCount': 0,
        'stats.lastActiveDate': today,
        'missions.voteMission': { claimed: false, lastClaimedDate: '' },
        'missions.commentMission': { claimed: false, lastClaimedDate: '' },
        'missions.postMission': { claimed: false, lastClaimedDate: '' },
        'missions.hotCaseMission': { claimed: false, lastClaimedDate: '' },
      });
    } else {
      transaction.update(userRef, { 'stats.commentCount': increment(1) });
    }
  });

  return docRef.id;
};

/**
 * 댓글을 수정합니다.
 * @param caseId - 고민 ID
 * @param commentId - 댓글 ID
 * @param content - 수정할 내용
 */
export const updateComment = async (caseId: string, commentId: string, content: string): Promise<void> => {
  if (!db) throw new Error('Firebase가 초기화되지 않았습니다.');
  const commentRef = doc(db, 'cases', caseId, 'comments', commentId);
  await updateDoc(commentRef, {
    content,
  });
};

/**
 * 댓글을 삭제합니다.
 * @param caseId - 고민 ID
 * @param commentId - 댓글 ID
 */
export const deleteComment = async (caseId: string, commentId: string): Promise<void> => {
  if (!db) throw new Error('Firebase가 초기화되지 않았습니다.');
  const commentRef = doc(db, 'cases', caseId, 'comments', commentId);
  await deleteDoc(commentRef);
};

/**
 * 대댓글을 수정합니다.
 * @param caseId - 고민 ID
 * @param commentId - 댓글 ID
 * @param replyId - 대댓글 ID
 * @param content - 수정할 내용
 */
export const updateReply = async (caseId: string, commentId: string, replyId: string, content: string): Promise<void> => {
  if (!db) throw new Error('Firebase가 초기화되지 않았습니다.');
  const replyRef = doc(db, 'cases', caseId, 'comments', commentId, 'replies', replyId);
  await updateDoc(replyRef, {
    content,
  });
};

/**
 * 대댓글을 삭제합니다.
 * @param caseId - 고민 ID
 * @param commentId - 댓글 ID
 * @param replyId - 대댓글 ID
 */
export const deleteReply = async (caseId: string, commentId: string, replyId: string): Promise<void> => {
  if (!db) throw new Error('Firebase가 초기화되지 않았습니다.');
  const replyRef = doc(db, 'cases', caseId, 'comments', commentId, 'replies', replyId);
  await deleteDoc(replyRef);
};

/**
 * 특정 고민의 총 댓글 개수(대댓글 포함)를 조회합니다.
 * 이제 Firestore의 commentCount 필드를 직접 읽어옵니다. (매우 빠름)
 * @param caseId - 고민 ID
 * @returns 총 댓글 및 대댓글 개수
 */
export const getCommentCount = async (caseId: string): Promise<number> => {
  if (!db) throw new Error('Firebase가 초기화되지 않았습니다.');
  try {
    const docRef = doc(db, 'cases', caseId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().commentCount || 0;
    }
    return 0;
  } catch (error) {
    console.error('댓글 개수 조회 실패:', error);
    return 0;
  }
};