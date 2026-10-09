"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Headphones, Mic, MicOff, PhoneOff, Settings2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { addRecentInteraction } from "@/lib/firestore";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import TopBar from "@/components/layout/TopBar";
import Loader from "@/components/ui/Loader";
import Callout from "@/components/ui/Callout";
import { cn } from "@/lib/utils";

type CallStatus = "idle" | "connecting" | "live" | "ending";
interface Line {
  role: "assistant" | "user";
  text: string;
  final: boolean;
}
// Minimal shape of the Vapi client we use (the SDK is imported lazily because it touches browser globals).
interface VapiClient {
  start: (assistantId: string, overrides?: Record<string, unknown>) => Promise<unknown>;
  stop: () => Promise<void>;
  setMuted: (mute: boolean) => void;
  on: (event: string, cb: (...args: never[]) => void) => void;
  removeAllListeners?: () => void;
}

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
const ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

/** Vapi reports errors in several shapes ({error:{msg}}, {message}, or a bare string); reduce any of them to text. */
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

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function VoiceTutorPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const vapi = useRef<VapiClient | null>(null);
  const transcriptEnd = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<CallStatus>("idle");
  const [topic, setTopic] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [assistantSpeaking, setAssistantSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  // Mirrors of state for event handlers, which would otherwise see stale values.
  const statusRef = useRef<CallStatus>("idle");
  const linesRef = useRef<Line[]>([]);
  const topicRef = useRef("");
  const secondsRef = useRef(0);

  useEffect(() => {
    statusRef.current = status;
    linesRef.current = lines;
    topicRef.current = topic;
    secondsRef.current = seconds;
  });

  useEffect(() => {
    if (!loading && (!user || !profile)) router.replace("/login");
    else if (!loading && profile?.role === "teacher") router.replace("/teacher-dashboard");
  }, [user, profile, loading, router]);

  // Keep the newest line in view.
  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines]);

  // Call timer.
  useEffect(() => {
    if (status !== "live") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  // Never leave a microphone open when the page goes away.
  useEffect(() => {
    return () => {
      void vapi.current?.stop().catch(() => {});
    };
  }, []);

  const onMessage = useCallback((m: { type?: string; role?: string; transcript?: string; transcriptType?: string }) => {
    if (m?.type !== "transcript" || !m.transcript) return;
    const role = m.role === "assistant" ? "assistant" : "user";
    const final = m.transcriptType === "final";
    setLines((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role && !last.final) return [...prev.slice(0, -1), { role, text: m.transcript!, final }];
      // A new speaker means the previous line is finished.
      const closed = last && !last.final ? [...prev.slice(0, -1), { ...last, final: true }] : prev;
      return [...closed, { role, text: m.transcript!, final }];
    });
  }, []);

  const start = async () => {
    if (!PUBLIC_KEY || !ASSISTANT_ID || statusRef.current !== "idle") return;
    setError("");
    setLines([]);
    setSeconds(0);
    setMuted(false);
    setStatus("connecting");
    try {
      const { default: Vapi } = await import("@vapi-ai/web");
      const client = new Vapi(PUBLIC_KEY) as unknown as VapiClient;
      vapi.current = client;

      client.on("call-start", (() => setStatus("live")) as () => void);
      client.on("call-end", (() => {
        setStatus("idle");
        setAssistantSpeaking(false);
        setVolume(0);
        // Remember the session in the learner's history (only if a real conversation happened).
        const spoken = linesRef.current.filter((l) => l.role === "user").length;
        if (user && spoken > 0 && secondsRef.current >= 10) {
          void addRecentInteraction(user.uid, {
            type: "doubt",
            topic: topicRef.current.trim() || "Voice tutor session",
            outcome: `voice tutor · ${Math.max(1, Math.round(secondsRef.current / 60))} min`,
            timestamp: Date.now(),
          }).catch(() => {});
        }
      }) as () => void);
      client.on("speech-start", (() => setAssistantSpeaking(true)) as () => void);
      client.on("speech-end", (() => setAssistantSpeaking(false)) as () => void);
      client.on("volume-level", ((v: number) => setVolume(v)) as (v: never) => void);
      client.on("message", onMessage as (m: never) => void);
      client.on("error", ((e: unknown) => {
        // Vapi also reports "meeting ended" style errors as a call winds down; those aren't failures.
        if (statusRef.current === "idle" || statusRef.current === "ending") return;
        console.error("Vapi error:", e);
        const raw = errorText(e);
        // Hitting the 10-minute cap or the tutor hanging up surfaces as "Meeting has ended": just end quietly.
        if (/meeting has ended|ejected/i.test(raw)) {
          setStatus("idle");
          setAssistantSpeaking(false);
          setVolume(0);
          return;
        }
        setError(/permission|denied|NotAllowed/i.test(raw) ? "Microphone access is blocked. Allow it in your browser's address bar, then try again." : raw || "The call couldn't be connected.");
        setStatus("idle");
      }) as (e: never) => void);

      await client.start(ASSISTANT_ID, {
        variableValues: {
          studentName: profile?.displayName?.split(" ")[0] || "there",
          topic: topic.trim() || "not specified yet",
        },
      });
    } catch (e) {
      console.error(e);
      const raw = e instanceof Error ? e.message : "";
      setError(/permission|denied|NotAllowed/i.test(raw) ? "Microphone access is blocked. Allow it in your browser's address bar, then try again." : "Couldn't start the call. Check your connection and microphone, then try again.");
      setStatus("idle");
    }
  };

  const end = async () => {
    setStatus("ending");
    await vapi.current?.stop().catch(() => {});
    setStatus("idle");
  };

  const toggleMute = () => {
    const next = !muted;
    vapi.current?.setMuted(next);
    setMuted(next);
  };

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  const configured = !!PUBLIC_KEY && !!ASSISTANT_ID;
  const live = status === "live";
  const busy = status === "connecting" || status === "ending";

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="lg:ml-64">
        <TopBar title="Voice Tutor" />
        <main className="mx-auto grid max-w-6xl gap-6 p-4 pb-24 md:p-6 lg:grid-cols-[0.9fr_1.1fr] lg:pb-8">
          {/* Call panel */}
          <section className="flex flex-col items-center rounded-card border border-line bg-sheet p-8 text-center shadow-sheet">
            {!configured ? (
              <div className="w-full py-2 text-left">
                <Callout tone="warning" icon={Settings2} title="Voice tutor isn't set up yet">
                  Add these to your environment (locally in .env.local, and in Vercel), then restart:
                </Callout>
                <pre className="mt-3 overflow-x-auto rounded-xl border border-line bg-paper p-4 text-xs text-ink">
{`NEXT_PUBLIC_VAPI_PUBLIC_KEY=...
NEXT_PUBLIC_VAPI_ASSISTANT_ID=...`}
                </pre>
              </div>
            ) : (
              <>
                {/* The orb pulses with the voice level while someone is talking. */}
                <div className="relative mt-4 flex h-52 w-52 items-center justify-center">
                  <span
                    className="absolute inset-0 rounded-full bg-pen/10 transition-transform duration-150"
                    style={{ transform: `scale(${live ? 1 + volume * 0.9 : 1})` }}
                  />
                  <span
                    className="absolute inset-6 rounded-full bg-pen/15 transition-transform duration-150"
                    style={{ transform: `scale(${live ? 1 + volume * 0.5 : 1})` }}
                  />
                  <button
                    onClick={live ? end : start}
                    disabled={busy}
                    aria-label={live ? "End call" : "Start call"}
                    className={cn(
                      "relative flex h-28 w-28 items-center justify-center rounded-full text-snow shadow-xl transition-all hover:scale-105 disabled:opacity-60",
                      live ? "bg-margin" : "bg-pen"
                    )}
                  >
                    {live ? <PhoneOff className="h-9 w-9" /> : <Headphones className="h-10 w-10" />}
                  </button>
                </div>

                <p className="display mt-6 text-2xl text-ink">
                  {status === "connecting" ? "Connecting…" : status === "ending" ? "Ending…" : live ? (assistantSpeaking ? "Ωlvε is speaking" : "Listening…") : "Tap to talk it through"}
                </p>
                <p className="mt-1 h-5 font-mono text-xs tabular-nums text-muted">{live ? fmt(seconds) : ""}</p>

                {live ? (
                  <button onClick={toggleMute} className="mt-4 flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm text-ink hover:bg-ink/5">
                    {muted ? <MicOff className="h-4 w-4 text-margin" /> : <Mic className="h-4 w-4" />} {muted ? "Unmute" : "Mute"}
                  </button>
                ) : (
                  <div className="mt-6 w-full text-left">
                    <label className="mb-1.5 block text-sm font-medium text-ink">What are you stuck on? <span className="font-normal text-muted">Optional</span></label>
                    <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. De Morgan's laws, projectile motion…" className="w-full" disabled={busy} />
                  </div>
                )}

                {error && <Callout tone="error" title="Couldn't start the call" className="mt-4 w-full text-left">{error}</Callout>}
                <p className="mt-6 text-xs leading-5 text-muted">Your browser will ask for microphone access. Speak naturally; you can interrupt the tutor at any time.</p>
              </>
            )}
          </section>

          {/* Live transcript, written like notes on paper */}
          <section className="paper paper-plain flex min-h-[420px] flex-col px-6 pb-6 pt-6 sm:px-8">
            <p className="hand ink-blue text-3xl leading-none">Conversation notes</p>
            <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1" style={{ maxHeight: "60vh" }}>
              {lines.length === 0 ? (
                <p className="serif text-[15px] leading-7 text-[#1b2440]/60">
                  {live ? "Say hello. What you and the tutor say will be written here as you go." : "Start a call and the conversation appears here live, so you can read back what was explained."}
                </p>
              ) : (
                lines.map((l, i) => (
                  <div key={i} className={cn(!l.final && "opacity-70")}>
                    <p className={cn("hand text-xl leading-none", l.role === "user" ? "ink-blue" : "ink-red")}>{l.role === "user" ? "You" : "Ωlvε"}</p>
                    <p className="serif text-[15px] leading-7 text-[#1b2440]">{l.text}</p>
                  </div>
                ))
              )}
              <div ref={transcriptEnd} />
            </div>
          </section>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
