import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/firestore";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = await getJob(id);
    if (!job) {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND", message: "Job not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, job });
  } catch (error) {
    console.error("Failed to fetch job:", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Failed to fetch job status" },
      { status: 500 }
    );
  }
}
