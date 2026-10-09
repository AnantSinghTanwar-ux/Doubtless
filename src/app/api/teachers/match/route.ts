import { NextRequest, NextResponse } from "next/server";
import { getTeachers } from "@/lib/firestore";
import { isOnline, normalize, rankTeachers, teacherSubjects, teachesGrade } from "@/lib/teacherRanking";
import type { DoubtRouterResult, MatchResponse } from "@/types";

/** Reading every teacher and ranking them is cheap, but give slow database connections room. */
export const maxDuration = 30;

interface Filters {
  subject?: string;
  grade?: number;
  onlineOnly?: boolean;
  verifiedOnly?: boolean;
  query?: string;
}

/**
 * Recommends teachers for a doubt. With a routerResult, teachers are ranked on topic fit, what students say about their
 * explaining and problem solving, and their track record, weighted by how hard the doubt is. Without one, it lists
 * everyone who is online, best-reviewed first.
 *
 * With `filters` it is a directory search instead: everyone matching the subject / grade / name filters, online first,
 * each still ranked for that subject and grade. The response then also lists the subjects available to filter on.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { routerResult?: Partial<DoubtRouterResult> | null; question?: unknown; limit?: unknown; filters?: Filters };
    const question = typeof body.question === "string" ? body.question.slice(0, 1500) : "";
    const teachers = await getTeachers();

    if (body.filters && typeof body.filters === "object") {
      const f = body.filters;
      const subject = typeof f.subject === "string" ? f.subject.trim() : "";
      const grade = Number(f.grade) >= 1 && Number(f.grade) <= 13 ? Math.round(Number(f.grade)) : 0;
      const q = typeof f.query === "string" ? normalize(f.query) : "";
      const pool = teachers.filter(
        (t) =>
          (!subject || teacherSubjects(t).includes(subject)) &&
          // Teachers who haven't listed their grades stay in, ranked below those who confirm this grade.
          (!grade || !Object.keys(t.subjectGrades ?? {}).length || teachesGrade(t, grade, subject || undefined)) &&
          (!f.verifiedOnly || t.verified) &&
          (!f.onlineOnly || isOnline(t)) &&
          (!q || normalize([t.name, t.headline ?? "", ...t.subjects, ...t.specialties].join(" ")).includes(q))
      );
      // A doubt (when there is one) ranks best; otherwise rank for the chosen subject and grade.
      const routerResult = body.routerResult?.topic ? body.routerResult : subject ? { topic: subject, grade_level: grade || undefined, confidence: 0.6 } : null;
      const rank = rankTeachers(pool, { routerResult, question });
      const subjects = [...new Set(teachers.flatMap(teacherSubjects))].sort();
      return NextResponse.json({
        matches: [...rank.online, ...rank.offline].slice(0, 50),
        offlineExperts: [],
        needsExpert: rank.needsExpert,
        complexity: rank.complexity,
        subjects,
        total: pool.length,
      } satisfies MatchResponse & { subjects: string[]; total: number });
    }

    const limit = Math.min(10, Math.max(1, Number(body.limit) || 3));
    const rank = rankTeachers(teachers, { routerResult: body.routerResult ?? null, question });
    const response: MatchResponse = {
      matches: rank.online.slice(0, limit),
      // Only worth showing when nobody suitable is online.
      offlineExperts: rank.online.length === 0 ? rank.offline.slice(0, 2) : [],
      needsExpert: rank.needsExpert,
      complexity: rank.complexity,
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error("Teacher matching error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Matching failed" }, { status: 500 });
  }
}
