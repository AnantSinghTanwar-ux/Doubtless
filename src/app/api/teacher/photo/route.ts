import { NextRequest, NextResponse } from "next/server";
import { getTeacherApplication } from "@/lib/firestore";
import { readMedia } from "@/lib/mediaStore";

/**
 * Public profile photo: serves only the teacher's live selfie, never their ID, certificate or video.
 * Public on purpose, since students see it on teacher cards (<img> tags can't send auth headers).
 */
export async function GET(request: NextRequest) {
  try {
    const uid = request.nextUrl.searchParams.get("uid") || "";
    const app = await getTeacherApplication(uid);
    if (!app?.files?.selfie) return new NextResponse(null, { status: 404 });
    const media = await readMedia(uid, "selfie");
    if (!media) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(media.bytes), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
