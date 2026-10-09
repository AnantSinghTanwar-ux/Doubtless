import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, isAdminEmail, requireUser } from "@/lib/serverAuth";
import { getMediaMeta, streamMedia } from "@/lib/mediaStore";
import type { VerificationFileKey } from "@/lib/teacherVerification";

const KEYS: VerificationFileKey[] = ["idDocument", "certificate", "selfie", "video"];

/** Streams one verification file to its owner or an admin. Supports ?token= for <img>/<video> tags. */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    // <img>/<video> tags can't send headers, so the ID token may come as a query parameter.
    const user = await requireUser(request, params.get("token"));

    const uid = params.get("uid") || "";
    const key = params.get("file") as VerificationFileKey;
    if (!KEYS.includes(key)) return NextResponse.json({ error: "Unknown file" }, { status: 400 });
    if (uid !== user.uid && !isAdminEmail(user.email)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

    const meta = await getMediaMeta(uid, key);
    if (!meta) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return new NextResponse(streamMedia(meta), {
      headers: {
        "Content-Type": meta.contentType,
        "Content-Length": String(meta.size),
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Verification file error:", error);
    return NextResponse.json({ error: "Could not load file" }, { status: 500 });
  }
}
