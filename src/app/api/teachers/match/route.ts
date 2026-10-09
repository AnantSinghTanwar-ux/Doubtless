import { NextRequest, NextResponse } from "next/server";
import { getTeachers } from "@/lib/firestore";
import { rankTeachers } from "@/lib/teacherRanking";
import type { DoubtRouterResult, MatchResponse } from "@/types";

/** Reading every teacher and ranking them is cheap, but give slow database connections room. */
export const maxDuration = 30;

/**
 * Recommends teachers for a doubt. With a routerResult, teachers are ranked on topic fit, what students say about their
 * explaining and problem solving, and their track record, weighted by how hard the doubt is. Without one, it lists
 * everyone who is online, best-reviewed first.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { routerResult?: Partial<DoubtRouterResult> | null; question?: unknown; limit?: unknown };
    const question = typeof body.question === "string" ? body.question.slice(0, 1500) : "";
    const limit = Math.min(10, Math.max(1, Number(body.limit) || 3));

    const rank = rankTeachers(await getTeachers(), { routerResult: body.routerResult ?? null, question });

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
