"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import { useMediaRecorder } from "@/hooks/useMediaRecorder";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import type { VoiceMetrics } from "@/types";

interface VoiceRecorderProps {
  onEvaluationRequest: (transcript: string, metrics: VoiceMetrics) => void;
  loading: boolean;
}

export default function VoiceRecorder({ onEvaluationRequest, loading }: VoiceRecorderProps) {
  const { isRecording: isAudioRecording, startRecording, stopRecording } = useMediaRecorder();
  const { transcript, isListening, metrics, startListening, stopListening } = useSpeechRecognition();
  
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

  return (
    <div className="bg-[#fffdf8]/55 border border-white/[0.06] rounded-2xl p-6">
      
      {recordingState === "idle" && (
        <div className="text-center py-8">
          <div className="w-24 h-24 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🎙️</span>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Ready to Explain?</h3>
          <p className="text-sm text-gray-400 mb-8 max-w-sm mx-auto">
            Hit record and explain the concept aloud as if you were teaching it to a 5-year-old.
          </p>
          <Button onClick={handleStart} size="lg" className="rounded-full px-8">
            Start Recording
          </Button>
        </div>
      )}

      {recordingState === "recording" && (
        <div className="text-center py-8">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-red-500/30 animate-ping"></div>
            <div className="relative w-full h-full rounded-full bg-red-500/20 flex items-center justify-center border-2 border-red-500">
              <span className="text-3xl text-red-500 animate-pulse">●</span>
            </div>
          </div>
          
          <div className="text-2xl font-mono text-white mb-6">
            {formatTime(timer)}
          </div>
          
          <div className="max-w-lg mx-auto bg-white/[0.05] rounded-xl p-4 min-h-[100px] mb-8 border border-[#e2d9c6] text-left">
            <p className="text-sm text-gray-300 italic h-full overflow-y-auto">
              {transcript || "Listening..."}
            </p>
          </div>

          <Button onClick={handleStop} variant="danger" size="lg" className="rounded-full px-8">
            Finish Explanation
          </Button>
        </div>
      )}

      {recordingState === "done" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h3 className="text-lg font-medium text-white">Review Transcript</h3>
            <Button onClick={handleReset} variant="ghost" size="sm" disabled={loading}>
              Retake
            </Button>
          </div>
          
          <div className="bg-white/[0.05] rounded-xl p-4 min-h-[120px] max-h-60 overflow-y-auto border border-[#e2d9c6]">
            <p className="text-sm text-gray-300 leading-relaxed">
              {transcript}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#fffdf8]/75 p-3 rounded-lg text-center">
              <div className="text-xs text-gray-500 uppercase">Words/Min</div>
              <div className="text-xl font-medium text-white">{metrics.wordsPerMinute}</div>
            </div>
            <div className="bg-[#fffdf8]/75 p-3 rounded-lg text-center">
              <div className="text-xs text-gray-500 uppercase">Filler Words</div>
              <div className="text-xl font-medium text-white">{metrics.fillerWordCount}</div>
            </div>
            <div className="bg-[#fffdf8]/75 p-3 rounded-lg text-center">
              <div className="text-xs text-gray-500 uppercase">Long Pauses</div>
              <div className="text-xl font-medium text-white">{metrics.longPauseCount}</div>
            </div>
            <div className="bg-[#fffdf8]/75 p-3 rounded-lg text-center">
              <div className="text-xs text-gray-500 uppercase">Max Pause</div>
              <div className="text-xl font-medium text-white">{metrics.longestPause}s</div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSubmit} loading={loading}>
              Get Feynman Analysis
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
