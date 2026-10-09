import { NextRequest, NextResponse } from "next/server";
import { recordAiCall, withUsage } from "@/lib/usage";

/** The voice tutor runs in the browser (Vapi), so the page reports the call length here when it ends. */
async function handlePost(request: NextRequest) {
  const { seconds } = await request.json().catch(() => ({}));
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return NextResponse.json({ error: "seconds required" }, { status: 400 });
  // Calls are capped at 10 minutes by the assistant settings; anything longer is not a real call.
  recordAiCall({ provider: "vapi", model: "voice", minutes: Math.min(s, 900) / 60 });
  return NextResponse.json({ ok: true });
}

export const POST = withUsage("voice-tutor.call", handlePost);
