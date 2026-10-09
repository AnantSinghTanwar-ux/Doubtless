"use client";

import { Camera, CameraOff, Loader2 } from "lucide-react";
import type { CameraStatus } from "@/hooks/useCamera";

export default function CameraPermission({ status, error, onStart, label }: { status: CameraStatus; error: string; onStart: () => void; label: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 dark-surface bg-[#0b0b10] px-6 text-center">
      {status === "starting" ? (
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      ) : status === "denied" || status === "unavailable" ? (
        <>
          <CameraOff className="w-9 h-9 text-rose-400" />
          <p className="text-sm text-slate-300 max-w-sm">{error}</p>
          <button onClick={onStart} className="rounded-lg bg-white/10 hover:bg-white/15 px-4 py-2 text-sm text-white">
            Try again
          </button>
        </>
      ) : (
        <>
          <div className="w-14 h-14 rounded-2xl bg-blue-500/15 flex items-center justify-center">
            <Camera className="w-6 h-6 text-blue-300" />
          </div>
          <p className="text-sm text-slate-400 max-w-xs">Your camera is used only for this verification. Nothing is recorded until you press the button.</p>
          <button onClick={onStart} className="rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-sm font-medium text-snow shadow-lg shadow-blue-600/25">
            {label}
          </button>
        </>
      )}
    </div>
  );
}
