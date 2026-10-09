"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Circle, RotateCcw, Square } from "lucide-react";
import { useCamera, type CameraStatus } from "@/hooks/useCamera";
import CameraPermission from "./CameraPermission";

export const MIN_VIDEO_SEC = 20;
const MAX_VIDEO_SEC = 90;
const FRAME_TIMES = [3, 9, 16];
const now = () => Date.now();

export interface VideoResult {
  blob: Blob;
  url: string;
  durationSec: number;
  frames: string[];
  prompt: string;
}

function pickMime() {
  const options = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return options.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) || "";
}

/** Records a live camera + mic introduction; the random spoken code proves it isn't a pre-made clip. */
export default function VideoIntro({
  subject,
  value,
  onChange,
  onCameraStatus,
}: {
  subject: string;
  value: VideoResult | null;
  onChange: (v: VideoResult | null) => void;
  onCameraStatus?: (s: CameraStatus) => void;
}) {
  const { videoRef, streamRef, status, error, start, stop, snapshot } = useCamera(true);
  useEffect(() => onCameraStatus?.(status), [status, onCameraStatus]);
  const [code] = useState(() => String(Math.floor(1000 + Math.random() * 9000)).split("").join(" "));
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const frames = useRef<string[]>([]);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);

  const prompt = `Say your full name, then read this code aloud: "${code}". Then explain one concept from ${subject || "your subject"} as you would to a student.`;

  useEffect(() => () => {
    if (ticker.current) clearInterval(ticker.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  // Revoke only on unmount: an effect keyed on `value` also fires on dev double-mount and kills the playback URL.
  const urlRef = useRef<string | null>(null);
  useEffect(() => {
    urlRef.current = value?.url ?? null;
  }, [value]);
  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const begin = () => {
    const stream = streamRef.current;
    if (!stream) return;
    const mimeType = pickMime();
    const rec = new MediaRecorder(stream, { mimeType: mimeType || undefined, videoBitsPerSecond: 350_000, audioBitsPerSecond: 48_000 });
    chunks.current = [];
    frames.current = [];
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    rec.onstop = () => {
      const type = (rec.mimeType || mimeType || "video/webm").split(";")[0];
      const blob = new Blob(chunks.current, { type });
      const durationSec = Math.round((now() - startedAt.current) / 1000);
      onChange({ blob, url: URL.createObjectURL(blob), durationSec, frames: frames.current, prompt });
      stop();
    };
    rec.start(1000);
    recorder.current = rec;
    startedAt.current = now();
    setElapsed(0);
    setRecording(true);
    ticker.current = setInterval(() => {
      const s = Math.floor((now() - startedAt.current) / 1000);
      setElapsed(s);
      if (FRAME_TIMES.includes(s) && frames.current.length < FRAME_TIMES.length) {
        const f = snapshot(640, 0.75);
        if (f) frames.current.push(f);
      }
      if (s >= MAX_VIDEO_SEC) finish();
    }, 1000);
  };

  const finish = () => {
    if (ticker.current) clearInterval(ticker.current);
    setRecording(false);
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  const redo = () => {
    if (value) URL.revokeObjectURL(value.url);
    onChange(null);
    start();
  };

  const pct = Math.min(100, (elapsed / MAX_VIDEO_SEC) * 100);
  const canStop = elapsed >= MIN_VIDEO_SEC;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm leading-6 text-amber-100">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300 mb-1">What to say</p>
        Say your full name, then read this code aloud:{" "}
        <span className="font-mono text-base font-bold text-white bg-white/10 rounded px-2 py-0.5 tracking-widest">{code}</span>
        <br />
        Then explain one concept from <span className="font-semibold text-white">{subject || "your subject"}</span> as you would to a student ({MIN_VIDEO_SEC}–{MAX_VIDEO_SEC} seconds).
      </div>

      <div className="relative aspect-video w-full dark-surface overflow-hidden rounded-2xl border border-white/10 bg-black">
        {value ? (
          <video src={value.url} controls playsInline className="w-full h-full object-contain bg-black" />
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover -scale-x-100" />
            {status === "live" && (
              <>
                <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-black/65 px-3 py-1.5 text-xs font-medium text-snow tabular-nums">
                  <span className={`w-2.5 h-2.5 rounded-full ${recording ? "bg-red-500 animate-pulse" : "bg-slate-400"}`} />
                  {recording ? `REC ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}` : "Ready"}
                </div>
                {recording && (
                  <div className="absolute bottom-0 inset-x-0 h-1.5 bg-white/10">
                    <div className={`h-full transition-[width] duration-1000 ease-linear ${canStop ? "bg-emerald-400" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
                    <div className="absolute top-0 h-full w-0.5 bg-white" style={{ left: `${(MIN_VIDEO_SEC / MAX_VIDEO_SEC) * 100}%` }} />
                  </div>
                )}
              </>
            )}
            {status !== "live" && <CameraPermission status={status} error={error} onStart={start} label="Turn on camera & microphone" />}
          </>
        )}
      </div>

      {value ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-emerald-300">
            <Check className="w-4 h-4" /> {value.durationSec}s introduction recorded — play it back to check your audio.
          </p>
          <button onClick={redo} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5">
            <RotateCcw className="w-4 h-4" /> Record again
          </button>
        </div>
      ) : (
        status === "live" &&
        (recording ? (
          <button
            onClick={finish}
            disabled={!canStop}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-60 py-3 text-sm font-semibold text-white"
          >
            <Square className="w-4 h-4 fill-current" />
            {canStop ? "Stop recording" : `Keep going… ${MIN_VIDEO_SEC - elapsed}s minimum`}
          </button>
        ) : (
          <button onClick={begin} className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 py-3 text-sm font-semibold text-snow shadow-lg shadow-red-600/25">
            <Circle className="w-4 h-4 fill-current" /> Start recording
          </button>
        ))
      )}
    </div>
  );
}
