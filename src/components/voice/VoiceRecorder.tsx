"use client";

import { useState, useEffect } from "react";
import { Mic } from "lucide-react";
import Button from "@/components/ui/Button";
import { useMediaRecorder } from "@/hooks/useMediaRecorder";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import type { VoiceMetrics } from "@/types";

interface VoiceRecorderProps {
  onEvaluationRequest: (transcript: string, metrics: VoiceMetrics) => void;
  loading: boolean;
}

export default function VoiceRecorder({ onEvaluationRequest, loading }: VoiceRecorderProps) {
  const { startRecording, stopRecording } = useMediaRecorder();
  const { transcript, metrics, startListening, stopListening } = useSpeechRecognition();

  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "done">("idle");
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recordingState === "recording") {
      interval = setInterval(() => setTimer(prev => prev + 1), 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [recordingState]);

  const handleStart = () => {
    startRecording();
    startListening();
    setRecordingState("recording");
  };

  const handleStop = () => {
    stopRecording();
    stopListening();
    setRecordingState("done");
  };

  const handleSubmit = () => {
    if (transcript.trim().length > 10) {
      onEvaluationRequest(transcript, metrics);
    } else {
      alert("Transcript is too short. Please try explaining in more detail.");
    }
  };

  const handleReset = () => {
    setRecordingState("idle");
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const stats = [
    { label: "Words per minute", value: metrics.wordsPerMinute },
    { label: "Filler words", value: metrics.fillerWordCount },
    { label: "Long pauses", value: metrics.longPauseCount },
    { label: "Longest pause", value: `${metrics.longestPause}s` },
  ];

  return (
    <div className="rounded-card border border-line bg-sheet p-6 shadow-sheet">
      {recordingState === "idle" && (
        <div className="py-8 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-pen/10 text-pen">
            <Mic className="h-9 w-9" aria-hidden />
          </div>
          <h3 className="mb-2 font-display text-xl font-semibold text-ink">Ready to explain?</h3>
          <p className="mx-auto mb-8 max-w-sm text-sm text-muted">Press record and explain the concept out loud, as if you were teaching it to a 5-year-old.</p>
          <Button onClick={handleStart} size="lg" className="px-8">
            Start recording
          </Button>
        </div>
      )}

      {recordingState === "recording" && (
        <div className="py-8 text-center">
          <div className="relative mx-auto mb-6 h-20 w-20">
            <div className="absolute inset-0 animate-ping rounded-full border-4 border-margin/30" />
            <div className="relative flex h-full w-full items-center justify-center rounded-full border-2 border-margin bg-margin/10">
              <span className="h-4 w-4 animate-pulse rounded-full bg-margin" aria-hidden />
            </div>
          </div>

          <div className="tabular mb-6 font-mono text-2xl text-ink" role="timer" aria-label="Recording time">
            {formatTime(timer)}
          </div>

          <div className="mx-auto mb-8 min-h-[100px] max-w-lg rounded-xl border border-line bg-paper p-4 text-left">
            <p className="h-full overflow-y-auto text-sm italic text-ink/80">{transcript || "Listening..."}</p>
          </div>

          <Button onClick={handleStop} variant="danger" size="lg" className="px-8">
            Finish explanation
          </Button>
        </div>
      )}

      {recordingState === "done" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <h3 className="font-display text-lg font-semibold text-ink">Review your transcript</h3>
            <Button onClick={handleReset} variant="ghost" size="sm" disabled={loading}>
              Record again
            </Button>
          </div>

          <div className="max-h-60 min-h-[120px] overflow-y-auto rounded-xl border border-line bg-paper p-4">
            <p className="text-sm leading-relaxed text-ink/80">{transcript}</p>
          </div>

          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-line bg-paper p-3 text-center">
                <dt className="text-xs text-muted">{s.label}</dt>
                <dd className="display tabular mt-0.5 text-2xl text-ink">{s.value}</dd>
              </div>
            ))}
          </dl>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSubmit} loading={loading}>
              Get my Feynman score
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
