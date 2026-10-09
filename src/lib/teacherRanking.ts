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
const PRIOR = 3.6; // what a teacher with no reviews is assumed to be worth, out of 5
const STOP = new Set(["the", "a", "an", "of", "and", "or", "in", "on", "to", "for", "is", "are", "how", "what", "why", "with", "from", "by", "this", "that", "it", "my", "i"]);

export const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const tokens = (s: string) => normalize(s).split(" ").filter((t) => t.length > 2 && !STOP.has(t));

const SUBJECT_WORDS: Record<string, string[]> = {
  Mathematics: "mathematics maths math algebra calculus geometry trigonometry arithmetic equation equations quadratic polynomial polynomials integral integrals integration derivative derivatives differentiation limits matrix matrices determinant probability statistics vector vectors logarithm logarithms fractions factorisation factorization linear sets discrete mensuration progression theorem proof simultaneous inequality inequalities coordinate".split(" "),
  Physics: "physics mechanics kinematics newton newtons optics thermodynamics electricity magnetism electromagnetism waves motion force forces momentum circuit circuits velocity acceleration gravitation gravity energy friction pendulum current voltage refraction".split(" "),
  Chemistry: "chemistry organic inorganic stoichiometry acid acids base bases reaction reactions periodic mole molarity bond bonding electrolysis oxidation reduction titration".split(" "),
  Biology: "biology cell cells genetics photosynthesis respiration ecology evolution anatomy physiology dna enzyme enzymes".split(" "),
  "Computer Science": "programming algorithm algorithms code coding python java datastructures recursion database sql".split(" "),
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

function subjectFit(t: TeacherProfile, ctx: Context): { score: number; kind: MatchEvidence["subjectMatch"]; specialties: string[] } {
  if (ctx.general) return { score: 0.5, kind: "none", specialties: [] };
  const topic = normalize(ctx.topic);
  const topicToks = tokens(ctx.topic);
  const subjects = t.subjects.map(normalize);
  // A teacher who lists "Calculus" or "Maths" teaches Mathematics; a doubt on "Algebra" is a Mathematics doubt.
  const teaches = new Set([...subjects, ...t.subjects.map((s) => normalize(canonicalSubject(s) ?? s))]);
  const exact = teaches.has(topic) || teaches.has(normalize(ctx.subject));
  const related = !exact && subjects.some((s) => topicToks.some((w) => s.includes(w) || w.includes(s)));

  // Specialties that overlap the topic, subtopic or the student's own words.
  const wanted = new Set([...tokens(ctx.topic), ...tokens(ctx.subtopic), ...tokens(ctx.question)]);
  const specialties = t.specialties.filter((sp) => tokens(sp).some((w) => wanted.has(w) || [...wanted].some((x) => x.length > 4 && w.length > 4 && (x.startsWith(w) || w.startsWith(x)))));

  const specScore = Math.min(0.3, specialties.length * 0.15);
  const sessions = t.topicStats?.[topicKey(ctx.subject)]?.sessions ?? 0;
  const sessionScore = Math.min(1, Math.log1p(sessions) / Math.log1p(8)) * 0.2;
  const base = exact ? 0.5 : related ? 0.28 : 0;
  return { score: Math.min(1, base + specScore + sessionScore), kind: exact ? "exact" : related ? "related" : "none", specialties };
}

export function scoreTeacher(t: TeacherProfile, ctx: Context): TeacherMatch {
  const c = ctx.complexity;
  const topicStat = ctx.general ? undefined : t.topicStats?.[topicKey(ctx.subject)];
  const fit = subjectFit(t, ctx);
  const dims = dimensions(t.reviewStats, topicStat);

  // Hard doubts need someone who can solve; easy ones need someone who explains well.
  const wSolve = 0.25 + 0.3 * c;
  const wDepth = 0.25 + 0.1 * c;
  const wExplain = 0.5 - 0.4 * c;
  // Stretch 3-5 stars across 0-1: anything under 3 is poor, and the differences between 4.0 and 4.8 should matter.
  const quality = Math.min(1, Math.max(0, ((wSolve * dims.solving + wDepth * dims.depth + wExplain * dims.explain) - 3) / 2));

  const resolvedN = topicStat && topicStat.n >= 2 ? topicStat : t.reviewStats;
  const resolvedRate = resolvedN && resolvedN.n > 0 ? avg(resolvedN.resolved, resolvedN.n) : null;
  const volume = Math.min(1, Math.log1p(t.doubtsResolved || 0) / Math.log1p(60));
  const track = 0.65 * shrink(resolvedN?.resolved ?? 0, resolvedN?.n ?? 0, 0.7, 3) + 0.35 * volume;

  const experience = Math.min((t.experienceYears ?? 0) / 12, 1) * 0.7 + (t.verified ? 0.3 : 0);

  // For demanding doubts, what students say about a teacher's solving matters most.
  const grade = gradeFit(t, ctx);
  const w = { fit: 0.38 + 0.1 * c, quality: 0.28 + 0.2 * c, track: 0.14, experience: 0.08, grade: ctx.grade ? 0.12 : 0 };
  const total = w.fit + w.quality + w.track + w.experience + w.grade;
  let score = (w.fit * fit.score + w.quality * quality + w.track * track + w.experience * experience + w.grade * grade.score) / total;
  if (grade.kind === "out") score *= 0.85; // a teacher who says they stop well below this level is a poor pick even if the subject matches
  if (!t.verified) score *= 0.93; // identity-checked teachers are preferred when everything else is close
  const pct = Math.round(Math.min(1, Math.max(0, score)) * 100);

  const rs = t.reviewStats;
  const evidence: MatchEvidence = {
    subjectMatch: fit.kind,
    matchedSpecialties: fit.specialties,
    topicSessions: topicStat?.sessions ?? 0,
    topicReviews: topicStat?.n ?? 0,
    reviewCount: rs?.n ?? 0,
    explain: rs && rs.n > 0 ? avg(rs.explain, rs.n) : null,
    depth: rs && rs.n > 0 ? avg(rs.depth, rs.n) : null,
    solving: rs && rs.n > 0 ? avg(rs.solving, rs.n) : null,
    resolvedRate,
    gradeMatch: grade.kind,
    gradeRange: grade.range,
    subject: ctx.subject,
  };

  return { teacher: t, score: pct, explanation: describe(evidence, t, ctx).join(" · "), reasons: describe(evidence, t, ctx), evidence, online: isOnline(t) };
}

const f1 = (n: number) => n.toFixed(1);

/** The strongest reasons first, phrased for a student. */
function describe(e: MatchEvidence, t: TeacherProfile, ctx: Context): string[] {
  const out: string[] = [];
  if (!ctx.general) {
    if (e.gradeMatch === "in" && e.gradeRange) out.push(`Teaches ${ctx.subject} for grades ${e.gradeRange[0]}-${e.gradeRange[1] >= 13 ? "college" : e.gradeRange[1]}`);
    else if (e.gradeMatch === "out" && e.gradeRange) out.push(`Usually teaches grades ${e.gradeRange[0]}-${e.gradeRange[1] >= 13 ? "college" : e.gradeRange[1]}, so this may be a stretch`);
    if (e.topicSessions > 0) out.push(`Has run ${e.topicSessions} ${ctx.subject} session${e.topicSessions === 1 ? "" : "s"} here`);
    else if (e.subjectMatch === "exact" && e.gradeMatch !== "in") out.push(`Teaches ${ctx.subject}`);
    else if (e.subjectMatch === "related") out.push("Teaches a related subject");
    if (e.matchedSpecialties.length) out.push(`Specialises in ${e.matchedSpecialties.slice(0, 2).join(" and ")}`);
  }
  if (e.reviewCount >= 2 && e.solving !== null && e.explain !== null) {
    const hard = ctx.complexity >= 0.6;
    const early = e.reviewCount < 5 ? "early reviews: " : "";
    out.push(hard ? `Solving problems: ${early}${f1(e.solving)}/5 from ${e.reviewCount} students` : `Clear explanations: ${early}${f1(e.explain)}/5 from ${e.reviewCount} students`);
    if (e.reviewCount >= 5 && e.depth !== null && e.depth >= 4.3) out.push(`Strong on the basics (${f1(e.depth)}/5)`);
  } else {
    out.push("Not reviewed much yet");
  }
  if (e.resolvedRate !== null && e.reviewCount >= 3) out.push(`${Math.round(e.resolvedRate * 100)}% of students say their doubt was resolved`);
  if (t.experienceYears) out.push(`${t.experienceYears} year${t.experienceYears === 1 ? "" : "s"} teaching`);
  if (t.verified) out.push("Identity verified");
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
  const scored = all.map((t) => scoreTeacher(t, ctx)).sort((a, b) => b.score - a.score || (b.teacher.ratingCount ?? 0) - (a.teacher.ratingCount ?? 0));

  // Someone with no connection to the subject should not be recommended for a specific doubt just for being online.
  const relevant = (m: TeacherMatch) => general || (m.evidence?.subjectMatch !== "none") || (m.evidence?.matchedSpecialties.length ?? 0) > 0;
  const now = opts.now ?? Date.now();
  const online = scored.filter((m) => isOnline(m.teacher, now) && relevant(m));
  const offline = scored.filter((m) => !isOnline(m.teacher, now) && relevant(m));
  return { online, offline, needsExpert: needsExpert(r), complexity: ctx.complexity };
}
