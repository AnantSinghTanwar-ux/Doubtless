import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  orderBy,
  limit,
  onSnapshot,
  deleteDoc,
  writeBatch,
  Unsubscribe,
  DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  UserProfile,
  VaultFolder,
  VaultDocument,
  VaultChunk,
  DoubtRecord,
  EvaluationRecord,
  VoiceSession,
  VivaRecord,
  LearnerProfile,
  TeacherProfile,
  SessionRecord,
  SessionMessage,
  PracticeSet,
  KnowledgeBaseEntry,
  RecentInteraction,
  JobRecord,
} from "@/types";

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function createUserProfile(profile: UserProfile): Promise<void> {
  await setDoc(doc(db, "users", profile.uid), profile);
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  await updateDoc(doc(db, "users", uid), data as DocumentData);
}

export async function getVaultFolders(userId: string): Promise<VaultFolder[]> {
  const q = query(collection(db, "vaultFolders"), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as VaultFolder));
}

export async function createVaultFolder(data: Omit<VaultFolder, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "vaultFolders"), data);
  return ref.id;
}

export async function deleteVaultFolder(folderId: string): Promise<void> {
  await deleteDoc(doc(db, "vaultFolders", folderId));
  // Note: documents inside this folder should ideally be deleted as well,
  // but for hackathon purposes we'll just delete the folder reference.
}

export async function getVaultDocuments(userId: string): Promise<VaultDocument[]> {
  const q = query(collection(db, "vaults"), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as VaultDocument));
}

export async function createVaultDocument(data: Omit<VaultDocument, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "vaults"), data);
  return ref.id;
}

export async function deleteVaultDocument(vaultId: string): Promise<void> {
  const chunksQuery = query(collection(db, "vaults", vaultId, "chunks"));
  const chunksSnap = await getDocs(chunksQuery);
  
  // Create a batch
  const batch = writeBatch(db);
  
  chunksSnap.docs.forEach((d) => {
    batch.delete(d.ref);
  });
  
  // Also delete the vault doc itself
  batch.delete(doc(db, "vaults", vaultId));
  
  // Commit the batch
  await batch.commit();
}

export async function saveVaultChunks(vaultId: string, chunks: Omit<VaultChunk, "id">[]): Promise<void> {
  const batch = chunks.map((chunk) => addDoc(collection(db, "vaults", vaultId, "chunks"), chunk));
  await Promise.all(batch);
}

export async function getVaultChunks(vaultId: string): Promise<VaultChunk[]> {
  const snap = await getDocs(collection(db, "vaults", vaultId, "chunks"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as VaultChunk));
}

export async function saveDoubt(data: Omit<DoubtRecord, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "doubts"), data);
  return ref.id;
}

export async function getUserDoubts(userId: string, maxResults = 20): Promise<DoubtRecord[]> {
  const q = query(
    collection(db, "doubts"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(maxResults)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DoubtRecord));
}

export async function saveEvaluation(data: Omit<EvaluationRecord, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "evaluations"), data);
  return ref.id;
}

export async function getUserEvaluations(userId: string): Promise<EvaluationRecord[]> {
  const q = query(
    collection(db, "evaluations"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as EvaluationRecord));
}

export async function saveVoiceSession(data: Omit<VoiceSession, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "voiceSessions"), data);
  return ref.id;
}

export async function getUserVoiceSessions(userId: string): Promise<VoiceSession[]> {
  const q = query(
    collection(db, "voiceSessions"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as VoiceSession));
}

export async function saveVivaRecord(data: Omit<VivaRecord, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "vivas"), data);
  return ref.id;
}

export async function savePracticeSet(data: Omit<PracticeSet, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "practiceSets"), data);
  return ref.id;
}

export async function getLearnerProfile(userId: string): Promise<LearnerProfile | null> {
  const snap = await getDoc(doc(db, "profiles", userId));
  return snap.exists() ? (snap.data() as LearnerProfile) : null;
}

export async function saveLearnerProfile(profile: LearnerProfile): Promise<void> {
  await setDoc(doc(db, "profiles", profile.userId), profile);
}

export async function updateLearnerProfile(userId: string, data: Partial<LearnerProfile>): Promise<void> {
  await updateDoc(doc(db, "profiles", userId), data as DocumentData);
}

export async function initLearnerProfile(userId: string): Promise<LearnerProfile> {
  const existing = await getLearnerProfile(userId);
  if (existing) return existing;
  const profile: LearnerProfile = {
    userId,
    topicMastery: {},
    mistakeFrequencies: {},
    explanationPreference: "visual",
    speakingConfidenceTrend: [],
    recentInteractions: [],
    totalDoubtsResolved: 0,
    aiResolved: 0,
    practiceResolved: 0,
    teacherResolved: 0,
    updatedAt: Date.now(),
  };
  await saveLearnerProfile(profile);
  return profile;
}

export async function addRecentInteraction(userId: string, interaction: RecentInteraction): Promise<void> {
  const profile = await getLearnerProfile(userId);
  if (!profile) return;
  const recent = [interaction, ...profile.recentInteractions].slice(0, 50);
  await updateLearnerProfile(userId, { recentInteractions: recent, updatedAt: Date.now() });
}

export async function getTeachers(): Promise<TeacherProfile[]> {
  const snap = await getDocs(collection(db, "teachers"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TeacherProfile));
}

export async function getAvailableTeachers(subject?: string): Promise<TeacherProfile[]> {
  let q;
  if (subject) {
    q = query(
      collection(db, "teachers"),
      where("availability", "==", true),
      where("subjects", "array-contains", subject)
    );
  } else {
    q = query(collection(db, "teachers"), where("availability", "==", true));
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TeacherProfile));
}

export async function createSession(data: Omit<SessionRecord, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "sessions"), data);
  return ref.id;
}

export async function getSession(sessionId: string): Promise<SessionRecord | null> {
  const snap = await getDoc(doc(db, "sessions", sessionId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as SessionRecord) : null;
}

export async function updateSession(sessionId: string, data: Partial<SessionRecord>): Promise<void> {
  await updateDoc(doc(db, "sessions", sessionId), data as DocumentData);
}

export async function getTeacherSessions(teacherId: string): Promise<SessionRecord[]> {
  const q = query(
    collection(db, "sessions"),
    where("teacherId", "==", teacherId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SessionRecord));
}

export async function getStudentSessions(studentId: string): Promise<SessionRecord[]> {
  const q = query(
    collection(db, "sessions"),
    where("studentId", "==", studentId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SessionRecord));
}

export async function sendMessage(sessionId: string, message: Omit<SessionMessage, "id">): Promise<void> {
  await addDoc(collection(db, "sessions", sessionId, "messages"), message);
}

export function subscribeToMessages(
  sessionId: string,
  callback: (messages: SessionMessage[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "sessions", sessionId, "messages"),
    orderBy("timestamp", "asc")
  );
  return onSnapshot(q, (snap) => {
    const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SessionMessage));
    callback(messages);
  });
}

export async function saveKnowledgeBase(data: Omit<KnowledgeBaseEntry, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "knowledgeBase"), data);
  return ref.id;
}

export async function searchKnowledgeBase(topic: string, subtopic?: string): Promise<KnowledgeBaseEntry[]> {
  let q;
  if (subtopic) {
    q = query(
      collection(db, "knowledgeBase"),
      where("topic", "==", topic),
      where("subtopic", "==", subtopic),
      limit(5)
    );
  } else {
    q = query(collection(db, "knowledgeBase"), where("topic", "==", topic), limit(5));
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as KnowledgeBaseEntry));
}

export async function getTeacherByUid(uid: string): Promise<TeacherProfile | null> {
  const q = query(collection(db, "teachers"), where("uid", "==", uid), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as TeacherProfile;
}

export async function createJob(data: Omit<JobRecord, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "jobs"), data);
  return ref.id;
}

export async function updateJob(jobId: string, data: Partial<JobRecord>): Promise<void> {
  await updateDoc(doc(db, "jobs", jobId), data as DocumentData);
}

export async function getJob(jobId: string): Promise<JobRecord | null> {
  const snap = await getDoc(doc(db, "jobs", jobId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as JobRecord) : null;
}
