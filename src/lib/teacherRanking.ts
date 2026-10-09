import type { DoubtRouterResult, GradeRange, MatchEvidence, RatingSums, TeacherMatch, TeacherProfile, TopicStat } from "@/types";

/**
 * Teacher recommendation. Pure functions only (no database), so the same logic runs on the server and in the browser.
 *
 * A teacher is scored on four things, weighted by how demanding the doubt is:
 *   topic fit   - do they teach this subject, specialise in this subtopic, have they run sessions on it
 *   quality     - student reviews of how they explain, how solid their basics are, how well they solve problems
 *   track record- how often students say the doubt was resolved, and how many they have helped
 *   experience  - years teaching and identity verification
 * Easy doubts reward clear explaining; hard ones reward the ability to actually solve the problem.
 * Reviews are shrunk toward a neutral prior, so one lucky 5-star review doesn't outrank a long, solid record.
 */

const ONLINE_WINDOW_MS = 150_000;
const PRIOR = 4.0; // what a teacher with no reviews is assumed to be worth, out of 5: neutral, not a penalty
const STOP = new Set(["the", "a", "an", "of", "and", "or", "in", "on", "to", "for", "is", "are", "how", "what", "why", "with", "from", "by", "this", "that", "it", "my", "i"]);

export const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const tokens = (s: string) => normalize(s).split(" ").filter((t) => t.length > 2 && !STOP.has(t));

const SUBJECT_WORDS: Record<string, string[]> = {
  Mathematics: "mathematics maths math algebra calculus geometry trigonometry arithmetic equation equations quadratic polynomial polynomials integral integrals integration derivative derivatives differentiation limits matrix matrices determinant probability statistics vector vectors logarithm logarithms fractions factorisation factorization linear sets discrete mensuration progression theorem proof simultaneous inequality inequalities coordinate".split(" "),
  Physics: "physics mechanics kinematics newton newtons optics thermodynamics electricity magnetism electromagnetism waves motion force forces momentum circuit circuits velocity acceleration gravitation gravity energy friction pendulum current voltage refraction".split(" "),
  Chemistry: "chemistry organic inorganic stoichiometry acid acids base bases reaction reactions periodic mole molarity bond bonding electrolysis oxidation reduction titration".split(" "),
  Biology: "biology cell cells genetics photosynthesis respiration ecology evolution anatomy physiology dna enzyme enzymes".split(" "),
  "Computer Science": "programming algorithm algorithms code coding python java javascript datastructures recursion database sql machine neural kernel kernels mercer svm svms perceptron backpropagation overfitting transformer transformers llm llms rag retrieval embedding embeddings tokenizer dataset datasets compiler operating cnn rnn lstm".split(" "),
  English: "english grammar essay literature poem comprehension vocabulary".split(" "),
  Economics: "economics demand supply inflation gdp microeconomics macroeconomics".split(" "),
  Accountancy: "accountancy accounting ledger balance journal".split(" "),
};

/**
 * Broad subject for a doubt or a teacher's listed subject: "Algebra" and "Integration" both mean Mathematics.
 * Looks at the topic first, then the subtopic, then the question, and returns null when nothing is recognisable.
 */
export function canonicalSubject(...texts: (string | undefined)[]): string | null {
  for (const text of texts) {
    if (!text) continue;
    const words = new Set(normalize(text).split(" "));
    let best: [string, number] | null = null;
    for (const [subject, list] of Object.entries(SUBJECT_WORDS)) {
      const hits = list.filter((w) => words.has(w)).length;
      if (hits > 0 && (!best || hits > best[1])) best = [subject, hits];
    }
    if (best) return best[0];
  }
  return null;
}

/** Key for a topic's stats; topics roll up to their subject so "Algebra" sessions count toward Mathematics. */
export const statKey = (topic: string, subtopic?: string) => topicKey(canonicalSubject(topic, subtopic) ?? topic);

/** Stable key for per-topic stats. Used for map keys, so it avoids dots and slashes. */
export function topicKey(topic: string, subtopic?: string): string {
  const slug = (s: string) => normalize(s).replace(/ /g, "-").slice(0, 40);
  return subtopic?.trim() ? `${slug(topic)}__${slug(subtopic)}` : slug(topic);
}

/** A teacher counts as online only if they switched availability on AND their dashboard has pinged recently. */
export function isOnline(t: Pick<TeacherProfile, "availability" | "lastSeenAt">, now = Date.now()): boolean {
  if (!t.availability) return false;
  return t.lastSeenAt === undefined ? true : now - t.lastSeenAt < ONLINE_WINDOW_MS; // older accounts have no heartbeat yet
}

/** 0-1: how demanding a doubt is, from its difficulty, kind and how unsure the router was. */
export function doubtComplexity(r: Partial<DoubtRouterResult> | null | undefined): number {
  if (!r) return 0.3;
  const base = r.difficulty === "hard" ? 0.75 : r.difficulty === "medium" ? 0.45 : 0.2;
  const kind = r.doubt_type === "needs_human" ? 0.2 : r.doubt_type === "prerequisite_gap" ? 0.05 : 0;
  const unsure = typeof r.confidence === "number" && r.confidence < 0.5 ? 0.15 : 0;
  return Math.min(1, base + kind + unsure);
}

/** Whether to put a recommended teacher in front of the student. */
export function needsExpert(r: Partial<DoubtRouterResult> | null | undefined): boolean {
  if (!r) return false;
  return r.route === "teacher" || doubtComplexity(r) >= 0.7;
}

const avg = (sum: number, n: number) => (n > 0 ? sum / n : 0);
/** Average pulled toward `prior`, as if the teacher already had `k` reviews at that value. */
const shrink = (sum: number, n: number, prior: number, k: number) => (sum + prior * k) / (n + k);

interface Dim {
  explain: number;
  depth: number;
  solving: number;
}

function dimensions(overall: RatingSums | undefined, topic: TopicStat | undefined): Dim {
  const pick = (key: "explain" | "depth" | "solving") => {
    const o = shrink(overall?.[key] ?? 0, overall?.n ?? 0, PRIOR, 4);
    return topic && topic.n > 0 ? shrink(topic[key], topic.n, o, 3) : o; // topic-specific record, anchored to their overall level
  };
  return { explain: pick("explain"), depth: pick("depth"), solving: pick("solving") };
}

/** The grade range a teacher gave for the doubt's subject, whatever name they used for it ("Maths", "Calculus"...). */
function rangeFor(t: TeacherProfile, subject: string): GradeRange | null {
  for (const [name, range] of Object.entries(t.subjectGrades ?? {})) {
    if (canonicalSubject(name) === subject || normalize(name) === normalize(subject)) return range;
  }
  return null;
}

function gradeFit(t: TeacherProfile, ctx: Context): { score: number; kind: MatchEvidence["gradeMatch"]; range: [number, number] | null } {
  const range = ctx.grade ? rangeFor(t, ctx.subject) : null;
  if (!ctx.grade || !range) return { score: 0.6, kind: "unknown", range: range ? [range.from, range.to] : null }; // unknown is neutral, not a penalty
  const d = ctx.grade < range.from ? range.from - ctx.grade : ctx.grade > range.to ? ctx.grade - range.to : 0;
  if (d === 0) return { score: 1, kind: "in", range: [range.from, range.to] };
  return { score: Math.max(0, 1 - 0.35 * d), kind: d <= 2 ? "near" : "out", range: [range.from, range.to] };
}

/** Broad subjects a teacher covers, from their subjects and specialties ("Calculus" counts as Mathematics). */
export function teacherSubjects(t: Pick<TeacherProfile, "subjects" | "specialties">): string[] {
  const out = new Set<string>();
  for (const s of [...(t.subjects ?? []), ...(t.specialties ?? [])]) out.add(canonicalSubject(s) ?? s.trim());
  return [...out].filter(Boolean);
}

/** Whether a teacher says they teach this grade (in the given subject, or in any subject when none is given). */
export function teachesGrade(t: TeacherProfile, grade: number, subject?: string): boolean {
  const ranges = subject ? [rangeFor(t, subject)] : Object.values(t.subjectGrades ?? {});
  return ranges.some((r) => !!r && grade >= r.from && grade <= r.to);
}

interface Context {
  /** Broad subject (Mathematics...), falling back to the topic as written. */
  subject: string;
  /** Rough grade of the question; 0 when unknown. */
  grade: number;
  topic: string;
  subtopic: string;
  question: string;
  complexity: number;
  general: boolean;
}

interface SpecialtyFit {
  strength: number;
  kind: MatchEvidence["specialtyMatch"];
  matched: string[];
}

/**
 * How well the teacher's own listed specialties fit the doubt:
 *   1.00  a specialty names this very subtopic ("particle physics" for a particle physics doubt)
 *   0.70  a specialty shares the key words of the subtopic or the student's question
 *   0.45  a specialty is the doubt's general subject ("Physics" for any physics doubt)
 */
function specialtyFit(t: TeacherProfile, ctx: Context): SpecialtyFit {
  if (ctx.general) return { strength: 0, kind: "none", matched: [] };
  const sub = normalize(ctx.subtopic);
  const top = normalize(ctx.topic);
  const subject = normalize(ctx.subject);
  const subToks = tokens(ctx.subtopic);
  const wanted = new Set([...subToks, ...tokens(ctx.question)]);
  const stem = (a: string, b: string) => a === b || (a.length > 4 && b.length > 4 && (a.startsWith(b) || b.startsWith(a)));

  let best = 0;
  const matched: { sp: string; s: number }[] = [];
  for (const sp of t.specialties) {
    const n = normalize(sp);
    const toks = tokens(sp);
    let s = 0;
    // A specialty that is only the general subject ("Physics") is NOT a match for a specific subtopic ("Particle Physics").
    const generic = n === top || n === subject || (!!top && top.includes(n) && n.length > 0 && n.split(" ").length === 1 && canonicalSubject(sp) === ctx.subject);
    if (generic) s = 0.45;
    else if (sub && (n === sub || n.includes(sub))) s = 1; // names this very subtopic (or something narrower within it)
    else if (sub && sub.includes(n) && n.length >= 4) s = 0.85; // a broader area that covers it ("Integration" for "Integration by parts")
    else if (toks.length > 0 && toks.some((w) => [...wanted].some((x) => stem(w, x)))) s = 0.7;
    else if ((top && (top.includes(n) || n.includes(top))) || canonicalSubject(sp) === ctx.subject) s = 0.45;
    if (s > 0) matched.push({ sp, s });
    best = Math.max(best, s);
  }
  matched.sort((x, y) => y.s - x.s);
  // Name the on-topic specialties when there are any; otherwise the general-subject ones.
  const onTopic = matched.filter((m) => m.s >= 0.7);
  const names = (onTopic.length ? onTopic : matched).slice(0, 3).map((m) => m.sp);
  return { strength: best, kind: best >= 0.7 ? "exact" : best > 0 ? "general" : "none", matched: names };
}

function subjectKind(t: TeacherProfile, ctx: Context): MatchEvidence["subjectMatch"] {
  if (ctx.general) return "none";
  const topic = normalize(ctx.topic);
  const topicToks = tokens(ctx.topic);
  const subjects = t.subjects.map(normalize);
  // A teacher who lists "Calculus" or "Maths" teaches Mathematics; a doubt on "Algebra" is a Mathematics doubt.
  const teaches = new Set([...subjects, ...t.subjects.map((s) => normalize(canonicalSubject(s) ?? s))]);
  if (teaches.has(topic) || teaches.has(normalize(ctx.subject))) return "exact";
  return subjects.some((s) => topicToks.some((w) => s.includes(w) || w.includes(s))) ? "related" : "none";
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function scoreTeacher(t: TeacherProfile, ctx: Context): TeacherMatch {
  const c = ctx.complexity;
  const subject = subjectKind(t, ctx);
  const spec = specialtyFit(t, ctx);
  const grade = gradeFit(t, ctx);
  const topicStat = ctx.general ? undefined : t.topicStats?.[topicKey(ctx.subject)];
  const rs = t.reviewStats;
  const reviewed = (rs?.n ?? 0) > 0;

  // ---- 1. Skill fit: do the skills this teacher declared match THIS doubt? (no reviews needed) ----
  // Weights: subject 45, specialty 40, grade 15. Grade only counts when both the question and the teacher state one.
  let skillFit: number;
  if (ctx.general) {
    skillFit = 0.5;
  } else {
    const subjectScore = subject === "exact" ? 1 : subject === "related" ? 0.45 : 0;
    const useGrade = grade.kind !== "unknown";
    const wSubject = 0.45;
    const wSpec = 0.4;
    const wGrade = useGrade ? 0.15 : 0;
    skillFit = (wSubject * subjectScore + wSpec * spec.strength + wGrade * grade.score) / (wSubject + wSpec + wGrade);
    // A subject match with no matching specialty is a decent generalist (about 0.5), not a perfect fit.
    if (subject === "exact" && spec.strength === 0) skillFit = Math.min(skillFit, 0.6);
    if (grade.kind === "out") skillFit *= 0.85; // a teacher who says they stop well below this level is a poor pick
  }

  // ---- 2. Track record: reviews, resolved rate, sessions. A teacher with no history sits at a neutral 0.5. ----
  const dims = dimensions(rs, topicStat);
  // Hard doubts reward problem solving; easy ones reward clear explaining.
  const wSolve = 0.25 + 0.3 * c;
  const wDepth = 0.25 + 0.1 * c;
  const wExplain = 0.5 - 0.4 * c;
  // Stretch 3-5 stars across 0-1, so the difference between 4.0 and 4.8 stars matters. Unreviewed teachers sit at 4.0 = 0.5.
  const quality = clamp01((wSolve * dims.solving + wDepth * dims.depth + wExplain * dims.explain - 3) / 2);

  const resolvedN = topicStat && topicStat.n >= 2 ? topicStat : rs;
  const resolvedRate = resolvedN && resolvedN.n > 0 ? avg(resolvedN.resolved, resolvedN.n) : null;
  const volume = clamp01(Math.log1p(t.doubtsResolved || 0) / Math.log1p(60));
  const sessionsHere = clamp01(Math.log1p(topicStat?.sessions ?? 0) / Math.log1p(8));
  const track = 0.8 * shrink(resolvedN?.resolved ?? 0, resolvedN?.n ?? 0, 0.7, 3) + 0.2 * Math.max(volume, sessionsHere);
  const experience = clamp01((t.experienceYears ?? 0) / 10);

  // Quality of reviews leads; experience and verification are small bonuses, never penalties.
  const trackRecord = clamp01(0.6 * quality + 0.28 * track + 0.07 * experience + (t.verified ? 0.05 : 0));

  // ---- 3. Blend. Skill fit leads; for demanding doubts the track record counts for more. ----
  // The more reviews a teacher has, the more their record counts: ten reviews say more than a declared skill list.
  const wTrack = ctx.general ? 0.7 : Math.min(0.85, 0.3 + 0.15 * c + 0.2 * clamp01((rs?.n ?? 0) / 10));
  const score = (1 - wTrack) * skillFit + wTrack * trackRecord;
  const pct = Math.round(clamp01(score) * 99);

  const evidence: MatchEvidence = {
    subjectMatch: subject,
    matchedSpecialties: spec.matched,
    topicSessions: topicStat?.sessions ?? 0,
    topicReviews: topicStat?.n ?? 0,
    reviewCount: rs?.n ?? 0,
    explain: reviewed ? avg(rs!.explain, rs!.n) : null,
    depth: reviewed ? avg(rs!.depth, rs!.n) : null,
    solving: reviewed ? avg(rs!.solving, rs!.n) : null,
    resolvedRate,
    gradeMatch: grade.kind,
    gradeRange: grade.range,
    subject: ctx.subject,
    skillFit,
    trackRecord,
    specialtyMatch: spec.kind,
    isNew: !reviewed,
  };

  const reasons = describe(evidence, t, ctx);
  return { teacher: t, score: pct, explanation: reasons.join(" · "), reasons, evidence, online: isOnline(t) };
}

const f1 = (n: number) => n.toFixed(1);

/** The strongest reasons first, phrased for a student. */
function describe(e: MatchEvidence, t: TeacherProfile, ctx: Context): string[] {
  const out: string[] = [];
  if (!ctx.general) {
    if (e.matchedSpecialties.length) {
      const names = e.matchedSpecialties.slice(0, 2).join(" and ");
      out.push(e.specialtyMatch === "exact" ? `Specialises in ${names}, which is what you asked about` : `Specialises in ${names}`);
    }
    if (e.topicSessions > 0) out.push(`Has run ${e.topicSessions} ${ctx.subject} session${e.topicSessions === 1 ? "" : "s"} here`);
    else if (e.subjectMatch === "exact") out.push(`Teaches ${ctx.subject}`);
    else if (e.subjectMatch === "related") out.push("Teaches a related subject");
    if (e.gradeMatch === "in" && e.gradeRange) out.push(`Covers grades ${e.gradeRange[0]}-${e.gradeRange[1] >= 13 ? "college" : e.gradeRange[1]}, which fits this question`);
    else if (e.gradeMatch === "out" && e.gradeRange) out.push(`Usually teaches grades ${e.gradeRange[0]}-${e.gradeRange[1] >= 13 ? "college" : e.gradeRange[1]}, so this may be a stretch`);
  }
  if (e.reviewCount >= 2 && e.solving !== null && e.explain !== null) {
    const hard = ctx.complexity >= 0.6;
    const early = e.reviewCount < 5 ? "early reviews: " : "";
    out.push(hard ? `Solving problems: ${early}${f1(e.solving)}/5 from ${e.reviewCount} students` : `Clear explanations: ${early}${f1(e.explain)}/5 from ${e.reviewCount} students`);
    if (e.reviewCount >= 5 && e.depth !== null && e.depth >= 4.3) out.push(`Strong on the basics (${f1(e.depth)}/5)`);
  } else {
    out.push("New teacher with no reviews yet, so this match rests on their skills");
  }
  if (e.resolvedRate !== null && e.reviewCount >= 3) out.push(`${Math.round(e.resolvedRate * 100)}% of students say their doubt was resolved`);
  if (t.experienceYears) out.push(`${t.experienceYears} year${t.experienceYears === 1 ? "" : "s"} teaching`);
  out.push(t.verified ? "Identity verified" : "Identity not verified yet");
  return out;
}

export interface RankOptions {
  routerResult?: Partial<DoubtRouterResult> | null;
  question?: string;
  now?: number;
}

export interface RankResult {
  online: TeacherMatch[];
  offline: TeacherMatch[];
  needsExpert: boolean;
  complexity: number;
}

/** Ranks everyone, then splits into who can take the doubt now and who is the best fit but offline. */
export function rankTeachers(all: TeacherProfile[], opts: RankOptions = {}): RankResult {
  const r = opts.routerResult ?? null;
  const general = !r?.topic;
  const subject = general ? "" : canonicalSubject(r?.topic, r?.subtopic, opts.question) ?? r?.topic ?? "";
  const grade = Number(r?.grade_level);
  const ctx: Context = { subject, grade: grade >= 1 && grade <= 13 ? Math.round(grade) : 0, topic: r?.topic ?? "", subtopic: r?.subtopic ?? "", question: opts.question ?? "", complexity: doubtComplexity(r), general };
  const scored = all.map((t) => scoreTeacher(t, ctx)).sort(
    (a, b) =>
      // Near-equal scores (within a point) go to the better skill fit, then to the better-evidenced teacher.
      (Math.abs(b.score - a.score) > 1 ? b.score - a.score : 0) ||
      (b.evidence?.skillFit ?? 0) - (a.evidence?.skillFit ?? 0) ||
      (b.teacher.ratingCount ?? 0) - (a.teacher.ratingCount ?? 0)
  );

  // Someone with no connection to the subject should not be recommended for a specific doubt just for being online.
  const relevant = (m: TeacherMatch) => general || (m.evidence?.subjectMatch !== "none") || (m.evidence?.matchedSpecialties.length ?? 0) > 0;
  const now = opts.now ?? Date.now();
  const online = scored.filter((m) => isOnline(m.teacher, now) && relevant(m));
  const offline = scored.filter((m) => !isOnline(m.teacher, now) && relevant(m));
  return { online, offline, needsExpert: needsExpert(r), complexity: ctx.complexity };
}
