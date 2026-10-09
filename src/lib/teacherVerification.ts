import { openRouterJSON, type OpenRouterContent } from "./aiProvider";
import { updateTeacherApplication } from "./firestore";
import { readMedia } from "./mediaStore";
import type { TeacherApplication, TeacherScreening } from "@/types";

export const FILE_RULES = {
  idDocument: { types: ["image/jpeg", "image/png", "image/webp", "application/pdf"], maxMB: 8 },
  certificate: { types: ["image/jpeg", "image/png", "image/webp", "application/pdf"], maxMB: 8 },
  selfie: { types: ["image/jpeg"], maxMB: 5 },
  video: { types: ["video/webm", "video/mp4"], maxMB: 20 },
} as const;

export type VerificationFileKey = keyof typeof FILE_RULES;

async function asDataUrl(uid: string, key: VerificationFileKey): Promise<string | null> {
  const media = await readMedia(uid, key);
  if (!media?.contentType.startsWith("image/")) return null;
  return `data:${media.contentType};base64,${Buffer.from(media.bytes).toString("base64")}`;
}

const screeningPrompt = `You are a trust & safety assistant helping a human reviewer verify a tutor applying to teach on an education platform. You receive the applicant's claimed details and evidence images. Compare them carefully and conservatively. You do not make the final decision; a human admin does.

Return ONLY JSON:
{
  "checks": [{ "label": string, "result": "pass" | "warn" | "fail", "detail": string }],
  "recommendation": "approve" | "review" | "reject",
  "summary": string   // 2-3 sentences for the reviewer
}

Include exactly these checks, in order (the "Gesture challenge" check goes right after "Live selfie", 8 checks in total):
1. "Government ID readable" - is the ID image a real identity document with a legible name? (warn if it's a PDF you could not see)
2. "Name matches ID" - does the name on the ID match the claimed full name?
3. "Qualification document" - does the certificate look like a genuine degree/qualification consistent with the claimed degree and institution?
4. "Live selfie" - is the selfie a live photo of a real person facing the camera (not a photo of a screen/printout, face clearly visible)?
   Then add a separate check labelled "Gesture challenge" - the applicant was asked to do the gesture given in the selfie's challenge text. Is that gesture visible in the selfie? Use "warn" (never "fail") if it is missing or unclear; this is advisory only and must not influence the recommendation on its own.
5. "Selfie consistent with ID photo" - advisory visual consistency only; use "warn" when unsure, never "fail" on appearance alone.
6. "Video consistent with selfie" - do the frames from the recorded introduction video show the same live person as the selfie?
7. "Profile completeness" - are the bio, subjects and experience coherent and plausible?

recommendation: "reject" only for clear fraud signals (fake/obviously edited documents, someone else's ID, no person on camera). "approve" only when every check passes. Otherwise "review".`;

export async function runScreening(app: TeacherApplication, videoFrames: string[]): Promise<void> {
  try {
    const content: OpenRouterContent[] = [
      {
        type: "text",
        text: `Applicant claims:\n${JSON.stringify({ personal: app.personal, professional: app.professional }, null, 2)}`,
      },
    ];
    const add = async (label: string, key: VerificationFileKey) => {
      const url = await asDataUrl(app.uid, key);
      content.push({ type: "text", text: url ? `${label}:` : `${label}: (uploaded as PDF, not shown)` });
      if (url) content.push({ type: "image_url", image_url: { url } });
    };
    await add("Government ID", "idDocument");
    await add("Qualification certificate", "certificate");
    if (app.files.selfie) await add(`Live selfie (challenge: "${app.liveness.selfieChallenge}")`, "selfie");
    videoFrames.slice(0, 3).forEach((url, i) => {
      content.push({ type: "text", text: `Frame ${i + 1} from the recorded introduction video:` });
      content.push({ type: "image_url", image_url: { url } });
    });

    const raw = await openRouterJSON<Omit<TeacherScreening, "status">>({ system: screeningPrompt, content, maxTokens: 1500 });
    const screening: TeacherScreening = {
      status: "done",
      recommendation: raw.recommendation === "approve" || raw.recommendation === "reject" ? raw.recommendation : "review",
      checks: Array.isArray(raw.checks) ? raw.checks.filter((c) => c && typeof c.label === "string") : [],
      summary: typeof raw.summary === "string" ? raw.summary : "",
      completedAt: Date.now(),
    };
    await updateTeacherApplication(app.uid, { screening });
  } catch (err) {
    console.error("Teacher screening failed:", err);
    await updateTeacherApplication(app.uid, {
      screening: { status: "failed", error: err instanceof Error ? err.message : String(err), completedAt: Date.now() },
    }).catch(() => {});
  }
}
