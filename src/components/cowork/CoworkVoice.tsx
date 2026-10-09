"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { hasFeature } from "@/lib/plans";
import { cn } from "@/lib/utils";

/**
 * Voice study partner inside CoWork. The student talks to the same Vapi assistant as the Voice Tutor, but it is given
 * what is on their screen: the document, the page they are on (its text and notes) and the study guide. When they move
 * to another page during the call, the assistant is told and given that page too.
 */
interface VapiClient {
  start: (assistantId: string, overrides?: Record<string, unknown>) => Promise<unknown>;
  stop: () => Promise<void>;
  setMuted: (mute: boolean) => void;
  send: (message: { type: "add-message"; message: { role: "system" | "user" | "assistant"; content: string }; triggerResponseEnabled?: boolean }) => void;
  on: (event: string, cb: (...args: never[]) => void) => void;
}

export interface PageContext {
  title: string;
  /** Text and notes for the page, ready to hand to the assistant. */
  content: string;
}

interface Props {
  fileName: string;
  page: number;
  numPages: number;
  getPageContext: (page: number) => Promise<PageContext>;
  /** Short description of the whole document (from the study guide), if there is one yet. */
  documentSummary: string;
}

type Status = "idle" | "connecting" | "live" | "ending";
interface Line {
  role: "assistant" | "user";
  text: string;
}

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
const ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function errorText(e: unknown): string {
  const pick = (v: unknown): string => {
    if (typeof v === "string") return v;
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      return pick(o.msg) || pick(o.message) || pick(o.error) || "";
    }
    return "";
  };
  return pick(e);
}

const GUIDE = `You are now helping a student who is reading a document in Sθlvε's CoWork reading mode. You can see what is on their screen: it is given below and updated when they move to another page. Answer from this content: summarise the page, explain the parts they find confusing, connect it to earlier pages, or quiz them on it. Say formulas in words. Keep turns short and spoken, never read long passages aloud. If they ask about something that is not in the document, say so briefly and then help from general knowledge.`;

export default function CoworkVoice({ fileName, page, numPages, getPageContext, documentSummary }: Props) {
  const { profile } = useAuth();
  const vapi = useRef<VapiClient | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [volume, setVolume] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const statusRef = useRef<Status>("idle");
  const secondsRef = useRef(0);
  const sentPage = useRef(0);
  const pageRef = useRef(page);

  useEffect(() => {
    statusRef.current = status;
    secondsRef.current = seconds;
    pageRef.current = page;
  });

  useEffect(() => {
    if (status !== "live") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  // Never leave a microphone open when the reader closes.
  useEffect(() => () => void vapi.current?.stop().catch(() => {}), []);

  /** Tell the assistant what is on screen. Silent: it uses this for its next answers but doesn't speak because of it. */
  const shareContext = useCallback(
    async (p: number, first: boolean) => {
      const client = vapi.current;
      if (!client) return;
      sentPage.current = p;
      const ctx = await getPageContext(p);
      const content = first
        ? `${GUIDE}\n\nDOCUMENT: "${fileName}" (${numPages} pages).${documentSummary ? `\nWHAT IT COVERS: ${documentSummary}` : ""}\n\nTHE STUDENT IS ON PAGE ${p}${ctx.title ? ` ("${ctx.title}")` : ""}:\n${ctx.content}`
        : `The student has moved to page ${p}${ctx.title ? ` ("${ctx.title}")` : ""}. It is now on their screen:\n${ctx.content}`;
      try {
        client.send({ type: "add-message", message: { role: "system", content: content.slice(0, 7000) }, triggerResponseEnabled: false });
      } catch (err) {
        console.warn("CoWork voice: could not share the page:", err);
      }
    },
    [getPageContext, fileName, numPages, documentSummary]
  );

  // Moving to another page during a call: share it once they settle there.
  useEffect(() => {
    if (status !== "live" || page === sentPage.current) return;
    const t = setTimeout(() => void shareContext(page, false), 1500);
    return () => clearTimeout(t);
  }, [page, status, shareContext]);

  const start = async () => {
    if (!PUBLIC_KEY || !ASSISTANT_ID || statusRef.current !== "idle") return;
    setError("");
    setLines([]);
    setSeconds(0);
    setMuted(false);
    setStatus("connecting");
    try {
      const [{ default: Vapi }, ctx] = await Promise.all([import("@vapi-ai/web"), getPageContext(pageRef.current)]);
      const client = new Vapi(PUBLIC_KEY) as unknown as VapiClient;
      vapi.current = client;
      const name = profile?.displayName?.split(" ")[0] || "there";

      client.on("call-start", (() => {
        setStatus("live");
        void shareContext(pageRef.current, true);
      }) as () => void);
      client.on("call-end", (() => {
        setStatus("idle");
        setSpeaking(false);
        setVolume(0);
        // Vapi bills per minute: report the call so its cost shows up in usage.
        if (secondsRef.current > 0) void fetch("/api/usage/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seconds: secondsRef.current }) }).catch(() => {});
      }) as () => void);
      client.on("volume-level", ((v: number) => setVolume(v)) as (v: never) => void);
      client.on("speech-start", (() => setSpeaking(true)) as () => void);
      client.on("speech-end", (() => setSpeaking(false)) as () => void);
      client.on("message", ((m: { type?: string; role?: string; transcript?: string; transcriptType?: string }) => {
        if (m?.type !== "transcript" || m.transcriptType !== "final" || !m.transcript) return;
        const role = m.role === "assistant" ? "assistant" : "user";
        setLines((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === role) return [...prev.slice(0, -1), { role, text: `${last.text} ${m.transcript!.trim()}` }];
          return [...prev.slice(-7), { role, text: m.transcript!.trim() }];
        });
      }) as (m: never) => void);
      client.on("error", ((e: unknown) => {
        if (statusRef.current === "idle" || statusRef.current === "ending") return;
        const raw = errorText(e);
        if (/meeting has ended|ejected/i.test(raw)) {
          setStatus("idle");
          return;
        }
        console.warn("CoWork voice error:", e);
        setError(/permission|denied|NotAllowed/i.test(raw) ? "Microphone access is blocked. Allow it in the address bar, then try again." : raw || "The call couldn't be connected.");
        setStatus("idle");
      }) as (e: never) => void);

      await client.start(ASSISTANT_ID, {
        variableValues: { studentName: name, topic: `${fileName}, page ${pageRef.current}${ctx.title ? `: ${ctx.title}` : ""}` },
        firstMessage: `Hi ${name}, I can see you're on page ${pageRef.current}${ctx.title ? `, ${ctx.title}` : ""}. Should I explain it, summarise it, or is something on it confusing?`,
      });
    } catch (e) {
      console.warn(e);
      const raw = e instanceof Error ? e.message : "";
      setError(/permission|denied|NotAllowed/i.test(raw) ? "Microphone access is blocked. Allow it in the address bar, then try again." : "Couldn't start the call. Check your connection and microphone.");
      setStatus("idle");
    }
  };

  const end = async () => {
    setStatus("ending");
    await vapi.current?.stop().catch(() => {});
    setStatus("idle");
  };

  const toggleMute = () => {
    vapi.current?.setMuted(!muted);
    setMuted((m) => !m);
  };

  if (!PUBLIC_KEY || !ASSISTANT_ID || !hasFeature(profile?.plan, "voiceAgent")) return null;

  const live = status === "live";
  const active = status !== "idle";
  const last = lines[lines.length - 1];
  const caption =
    error ||
    (status === "connecting" ? `Sharing page ${page} with your tutor…` : live ? (last ? last.text : "Listening… ask anything about this page.") : "");
  // The orb swells with the voice level, capped so it stays a small corner element.
  const scale = live ? 1 + Math.min(1, volume) * 0.35 : 1;

  return (
    <div className="fixed bottom-5 right-5 z-40 flex items-end gap-3" role="region" aria-label="Voice study partner">
      {caption && (
        <div
          className={cn(
            "mb-2 max-w-[min(18rem,calc(100vw-7rem))] rounded-2xl rounded-br-sm border border-line bg-sheet/95 px-3.5 py-2.5 text-sm shadow-lift backdrop-blur",
            error ? "text-rose-600" : "text-ink"
          )}
          aria-live="polite"
        >
          {live && last && <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide text-faint">{last.role === "assistant" ? "Tutor" : "You"}</span>}
          <span className="line-clamp-4">{caption}</span>
          {live && <span className="tabular mt-1 block text-[11px] text-faint">{fmt(seconds)} · page {page}</span>}
          {error && !active && (
            <button onClick={() => setError("")} className="mt-1 block text-xs text-muted underline">
              Dismiss
            </button>
          )}
        </div>
      )}

      <div className="relative flex flex-col items-center gap-2">
        {live && (
          <>
            <button
              onClick={toggleMute}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-sheet text-ink shadow-md hover:bg-paper"
              aria-label={muted ? "Unmute microphone" : "Mute microphone"}
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              onClick={() => void end()}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-700"
              aria-label="End the call"
              title="End call"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}
        <button
          onClick={() => (active ? undefined : void start())}
          disabled={status === "connecting" || status === "ending"}
          className={cn("group relative h-14 w-14 rounded-full", !active && "voice-orb-idle")}
          aria-label={active ? "Voice call in progress" : `Talk to the tutor about page ${page}`}
          title={active ? undefined : `Ask by voice about page ${page}`}
        >
          {/* A plain solid circle: it grows slightly with the voice level and breathes while idle. */}
          <span
            className={cn("absolute inset-0 rounded-full shadow-md transition-[transform,background-color] duration-150", muted ? "bg-ink/60" : "bg-pen group-hover:bg-pen-deep")}
            style={{ transform: `scale(${scale})` }}
          />
          {muted ? <MicOff className="absolute inset-0 m-auto h-5 w-5 text-snow" aria-hidden /> : <Mic className="absolute inset-0 m-auto h-5 w-5 text-snow" aria-hidden />}
        </button>
      </div>
    </div>
  );
}
