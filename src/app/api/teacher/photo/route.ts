import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getTeacherApplication } from "@/lib/firestore";
import { userDir } from "@/lib/teacherVerification";

/**
 * Public profile photo: serves only the teacher's live selfie, never their ID, certificate or video.
 * Public on purpose, since students see it on teacher cards (<img> tags can't send auth headers).
 */
export async function GET(request: NextRequest) {
  try {
    const uid = request.nextUrl.searchParams.get("uid") || "";
    const app = await getTeacherApplication(uid);
    const name = app?.files?.selfie;
    if (!name) return new NextResponse(null, { status: 404 });
    const data = await fs.readFile(path.join(userDir(uid), path.basename(name)));
    return new NextResponse(new Uint8Array(data), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
