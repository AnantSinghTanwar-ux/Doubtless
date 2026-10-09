import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { authErrorResponse, isAdminEmail, requireUser } from "@/lib/serverAuth";
import { getTeacherApplication } from "@/lib/firestore";
import { MIME_BY_EXT, userDir, type VerificationFileKey } from "@/lib/teacherVerification";

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

    const app = await getTeacherApplication(uid);
    const name = app?.files?.[key];
    if (!name) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const filePath = path.join(userDir(uid), path.basename(name));
    const data = await fs.readFile(filePath);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": MIME_BY_EXT[name.split(".").pop() || ""] || "application/octet-stream",
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
