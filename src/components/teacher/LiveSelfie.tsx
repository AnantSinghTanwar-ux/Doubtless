"use client";

import { useEffect, useRef, useState } from "react";
import { Check, RotateCcw, ScanFace } from "lucide-react";
import { useCamera, type CameraStatus } from "@/hooks/useCamera";
import CameraPermission from "./CameraPermission";

const CHALLENGES = [
  "Hold up three fingers next to your face",
  "Touch your right ear with your hand",
  "Give a thumbs up next to your face",
  "Raise your left hand with your palm open",
  "Hold up two fingers in a peace sign",
  "Place one hand flat on top of your head",
];

export interface SelfieResult {
  dataUrl: string;
  challenge: string;
  capturedAt: number;
}

/** Live camera capture only (no file picker), with a random gesture challenge to prove liveness. */
export default function LiveSelfie({
  value,
  onChange,
  onCameraStatus,
}: {
  value: SelfieResult | null;
  onChange: (v: SelfieResult | null) => void;
  onCameraStatus?: (s: CameraStatus) => void;
}) {
  const { videoRef, status, error, start, stop, snapshot } = useCamera(false);
  useEffect(() => onCameraStatus?.(status), [status, onCameraStatus]);
  const [challenge, setChallenge] = useState(() => CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const capture = () => {
    let n = 3;
    setCountdown(n);
    timer.current = setInterval(() => {
      n -= 1;
      if (n > 0) return setCountdown(n);
      clearInterval(timer.current!);
      setCountdown(null);
      const dataUrl = snapshot(1280, 0.9);
      if (dataUrl) {
        onChange({ dataUrl, challenge, capturedAt: Date.now() });
        stop();
      }
    }, 1000);
  };

  const retake = () => {
    onChange(null);
    setChallenge((c) => CHALLENGES.filter((x) => x !== c)[Math.floor(Math.random() * (CHALLENGES.length - 1))]);
    start();
  };

  return (
    <div className="space-y-4">
      <div className="relative aspect-[4/3] sm:aspect-video w-full dark-surface overflow-hidden rounded-2xl border border-white/10 bg-black">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.dataUrl} alt="Your captured selfie" className="w-full h-full object-cover" />
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover -scale-x-100" />
            {status === "live" && (
              <>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-[38%] aspect-[3/4] rounded-[50%] border-2 border-dashed border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                </div>
                <div className="absolute top-3 left-3 right-3 flex justify-center">
                  <div className="flex items-center gap-2 rounded-full bg-black/70 backdrop-blur px-4 py-2 text-sm text-snow">
                    <ScanFace className="w-4 h-4 text-amber-300 shrink-0" />
                    <span>
                      <span className="text-amber-200 font-semibold">Challenge: </span>
                      {challenge}
                    </span>
                  </div>
                </div>
                {countdown !== null && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span key={countdown} className="text-7xl font-bold text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)] animate-[cw-pop_0.5s_ease-out]">
                      {countdown}
                    </span>
                  </div>
                )}
                <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-snow">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> LIVE
                </span>
              </>
            )}
            {status !== "live" && <CameraPermission status={status} error={error} onStart={start} label="Turn on camera" />}
          </>
        )}
      </div>

      {value ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-emerald-300">
            <Check className="w-4 h-4" /> Live photo captured with challenge &ldquo;{value.challenge}&rdquo;
          </p>
          <button onClick={retake} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5">
            <RotateCcw className="w-4 h-4" /> Retake
          </button>
        </div>
      ) : (
        status === "live" && (
          <button
            onClick={capture}
            disabled={countdown !== null}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 py-3 text-sm font-semibold text-snow shadow-lg shadow-blue-600/25"
          >
            {countdown !== null ? "Hold still…" : "Do the challenge & capture"}
          </button>
        )
      )}
    </div>
  );
}
