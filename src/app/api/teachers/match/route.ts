import { NextRequest, NextResponse } from "next/server";
import { getAvailableTeachers } from "@/lib/firestore";
import type { TeacherMatch, DoubtRouterResult } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { routerResult } = (await request.json()) as {
      routerResult: DoubtRouterResult;
    };

    if (!routerResult) {
      return NextResponse.json({ error: "routerResult is required" }, { status: 400 });
    }

    const teachers = await getAvailableTeachers(routerResult.topic);
    const allTeachers = teachers.length === 0 ? await getAvailableTeachers() : teachers;

    const matches: TeacherMatch[] = allTeachers.map((teacher) => {
      let score = 0;
      const reasons: string[] = [];

      const subjectMatch = teacher.subjects.some(
        (s) => s.toLowerCase() === routerResult.topic.toLowerCase()
      );
      if (subjectMatch) {
        score += 40;
        reasons.push(`Expert in ${routerResult.topic}`);
      } else {
        const partialMatch = teacher.subjects.some((s) =>
          s.toLowerCase().includes(routerResult.topic.toLowerCase().split(" ")[0])
        );
        if (partialMatch) {
          score += 20;
          reasons.push(`Related subject knowledge`);
        }
      }

      score += Math.min(teacher.rating * 8, 30);
      reasons.push(`${teacher.rating.toFixed(1)}★ rating`);

      if (teacher.availability) {
        score += 15;
        reasons.push("Available now");
      }

      // Identity-verified teachers rank above unverified ones with otherwise similar scores.
      if (teacher.verified) {
        score += 10;
        reasons.push("Verified");
      }

      const successScore = Math.min(teacher.doubtsResolved / 10, 15);
      score += successScore;
      if (teacher.doubtsResolved > 0) {
        reasons.push(`${teacher.doubtsResolved} doubts resolved`);
      }

      return {
        teacher,
        score: Math.round(score),
        explanation: reasons.join(" · "),
      };
    });

    matches.sort((a, b) => b.score - a.score);

    return NextResponse.json({ matches: matches.slice(0, 3) });
  } catch (error) {
    console.error("Teacher matching error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Matching failed" },
      { status: 500 }
    );
  }
}
