import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/serverAuth";
import { getVaultDocuments } from "@/lib/firestore";
import { getMediaMeta, streamMedia } from "@/lib/mediaStore";

/** Streams a vault's original PDF to its owner (used by CoWork). */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const vaultId = request.nextUrl.searchParams.get("vaultId") || "";
    const owned = (await getVaultDocuments(user.uid)).some((v) => v.id === vaultId);
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const meta = await getMediaMeta(user.uid, `pdf-${vaultId}`);
    if (!meta) return NextResponse.json({ error: "PDF not stored" }, { status: 404 });
    return new NextResponse(streamMedia(meta), {
      headers: { "Content-Type": "application/pdf", "Content-Length": String(meta.size), "Cache-Control": "private, max-age=3600" },
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Could not load file" }, { status: 500 });
  }
}
