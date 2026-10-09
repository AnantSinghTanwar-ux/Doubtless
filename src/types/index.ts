export type UserRole = "student" | "teacher";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: UserRole;
  createdAt: number;
}

export interface VaultFolder {
  id: string;
  userId: string;
  name: string;
  createdAt: number;
}

export interface VaultDocument {
  id: string;
  userId: string;
  folderId?: string;
  type?: "content" | "paper";
  fileName: string;
  pageCount: number;
  chunkCount: number;
  uploadedAt: number;
}

export interface VaultChunk {
  id: string;
  vaultId: string;
  userId: string;
  text: string;
  pageNumber: number;
  chunkIndex: number;
  embedding: number[];
}

export interface RetrievedChunk {
  text: string;
  pageNumber: number;
  fileName: string;
  score: number;
}

export type DoubtType = "concept_gap" | "prerequisite_gap" | "careless_error" | "needs_human";
export type RouteType = "ai_explain" | "practice" | "teacher";

export interface DoubtRouterResult {
  topic: string;
  subtopic: string;
  difficulty: string;
  doubt_type: DoubtType;
  confidence: number;
  route: RouteType;
  reasoning: string;
}

export interface DoubtRecord {
  id: string;
  userId: string;
  question: string;
  inputType: "text" | "image" | "voice";
  routerResult: DoubtRouterResult;
  explanation?: string;
  vaultId?: string;
  chunks?: RetrievedChunk[];
  pastSessionContext?: string;
  createdAt: number;
  resolved: boolean;
}

export type StepVerdict = "correct" | "error" | "redundant" | "unclear";

export interface StepEvaluation {
  step: number;
  verdict: StepVerdict;
  error_type?: string;
  explanation: string;
  fix?: string;
}

export interface SolutionEvaluation {
  steps: StepEvaluation[];
  first_error_step: number | null;
  rubric: {
    correctness: number;
    method: number;
    clarity_notation: number;
    total: number;
  };
  model_solution: string;
  source_citations: Array<{ pdf_name: string; page: number }>;
}

export interface EvaluationRecord {
  id: string;
  userId: string;
  question: string;
  studentSolution: string[];
  evaluation: SolutionEvaluation;
  vaultId?: string;
  createdAt: number;
}

export interface VoiceMetrics {
  wordsPerMinute: number;
  fillerWordCount: number;
  longPauseCount: number;
  longestPause: number;
  fillerWords: Record<string, number>;
}

export interface VoiceEvaluation {
  content_accuracy: number;
  structure: number;
  clarity: number;
  confidence_score: number;
  filler_analysis: string;
  where_they_hesitated: string[];
  missing_concepts: string[];
  better_explanation: string;
  one_sentence_tip: string;
}

export interface VoiceSession {
  id: string;
  userId: string;
  topic: string;
  transcript: string;
  metrics: VoiceMetrics;
  evaluation: VoiceEvaluation;
  createdAt: number;
}

export interface VivaQuestion {
  question: string;
  difficulty: number;
  topic: string;
}

export interface VivaAnswer {
  question: string;
  answer: string;
  score: number;
  feedback: string;
  confidence: number;
}

export interface VivaReport {
  answers: VivaAnswer[];
  confidence_trend: number[];
  weak_topics: string[];
  study_plan: string[];
  overall_score: number;
}

export interface VivaRecord {
  id: string;
  userId: string;
  topic: string;
  report: VivaReport;
  vaultId?: string;
  createdAt: number;
}

export interface TeacherProfile {
  id: string;
  uid: string;
  name: string;
  email: string;
  photoURL: string | null;
  subjects: string[];
  rating: number;
  availability: boolean;
  doubtsResolved: number;
  specialties: string[];
  /** Set when an admin approves the teacher's verification application. */
  verified?: boolean;
  headline?: string;
  bio?: string;
  experienceYears?: number;
  institution?: string;
  ratingCount?: number;
}

/**
 * - "unverified": submitted without live camera checks; may teach but is labelled unverified.
 * - "pending": full live verification submitted, awaiting admin review.
 */
export type TeacherApplicationStatus = "unverified" | "pending" | "approved" | "rejected";

export interface TeacherApplication {
  uid: string;
  email: string;
  status: TeacherApplicationStatus;
  personal: {
    fullName: string;
    phone: string;
    city: string;
    headline: string;
    bio: string;
  };
  professional: {
    degree: string;
    institution: string;
    graduationYear: number;
    experienceYears: number;
    currentRole: string;
    linkedinUrl: string;
    subjects: string[];
    specialties: string[];
  };
  /** Stored file names under the applicant's private verification folder. */
  files: {
    idDocument: string;
    certificate: string;
    /** Absent when the applicant had no camera. */
    selfie?: string;
    video?: string;
  };
  liveness: {
    selfieChallenge: string;
    selfieCapturedAt: number;
    videoPrompt: string;
    videoDurationSec: number;
    /** True when the applicant registered without a working camera. */
    skipped?: boolean;
  };
  screening?: TeacherScreening;
  submittedAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  reviewNote?: string;
}

export interface TeacherScreening {
  status: "running" | "done" | "failed";
  recommendation?: "approve" | "review" | "reject";
  checks?: { label: string; result: "pass" | "warn" | "fail"; detail: string }[];
  summary?: string;
  error?: string;
  completedAt?: number;
}

export interface TeacherMatch {
  teacher: TeacherProfile;
  score: number;
  explanation: string;
}

export interface SessionMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface SessionRecord {
  id: string;
  studentId: string;
  teacherId: string;
  doubtId: string;
  /** "expired": nobody was in the session for a while and it was never ended. */
  status: "pending" | "active" | "completed" | "expired";
  /** Heartbeat written by whoever has the session page open; used to detect abandoned sessions. */
  lastActivityAt?: number;
  jitsiRoom: string;
  doubtContext: DoubtRouterResult;
  summary?: SessionSummary;
  createdAt: number;
  completedAt?: number;
}

export interface SessionSummary {
  doubt: string;
  root_cause: string;
  explanation_that_worked: string;
}

export interface LearnerProfile {
  userId: string;
  topicMastery: Record<string, number>;
  mistakeFrequencies: Record<string, number>;
  explanationPreference: string;
  speakingConfidenceTrend: number[];
  recentInteractions: RecentInteraction[];
  totalDoubtsResolved: number;
  aiResolved: number;
  practiceResolved: number;
  teacherResolved: number;
  updatedAt: number;
}

export interface RecentInteraction {
  type: "doubt" | "evaluation" | "voice" | "viva" | "practice" | "teacher_session";
  topic: string;
  subtopic?: string;
  outcome: string;
  score?: number;
  timestamp: number;
}

export interface PracticeQuestion {
  question: string;
  difficulty: number;
  topic: string;
  subtopic: string;
  expected_answer: string;
  hints: string[];
}

export interface PracticeSet {
  id: string;
  userId: string;
  topic: string;
  subtopic: string;
  questions: PracticeQuestion[];
  answers: Array<{
    questionIndex: number;
    answer: string;
    correct: boolean;
    feedback: string;
  }>;
  score: number;
  createdAt: number;
}

export interface KnowledgeBaseEntry {
  id: string;
  sessionId: string;
  teacherId: string;
  studentId: string;
  topic: string;
  subtopic: string;
  summary: SessionSummary;
  createdAt: number;
}

export interface JobRecord {
  id: string;
  userId: string;
  type: string;
  status: "pending" | "processing" | "completed" | "failed";
  result?: any;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

/** One WebRTC signalling message exchanged through sessions/{id}/signals. */
export interface CallSignal {
  id: string;
  from: string;
  /** Random per page-load, so a refreshed tab is treated as a new peer and stale messages are ignored. */
  fromJoin: string;
  /** Target peer's join id; absent for "hello" broadcasts. */
  to?: string;
  type: "hello" | "offer" | "answer" | "candidate";
  /** JSON-encoded session description or ICE candidate. */
  data?: string;
  ts: number;
}
