import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireAdmin } from "@/lib/serverAuth";
import { listTeacherApplications } from "@/lib/firestore";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    return NextResponse.json({ applications: await listTeacherApplications() });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("List applications error:", error);
    return NextResponse.json({ error: "Could not load applications" }, { status: 500 });
  }
}
