import { useState, useEffect, useRef, useCallback } from "react";
import type { VoiceMetrics } from "@/types";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const FILLER_WORDS = ["um", "uh", "like", "basically", "you know", "so", "actually", "literally"];

export function useSpeechRecognition() {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [metrics, setMetrics] = useState<VoiceMetrics>({
    wordsPerMinute: 0,
    fillerWordCount: 0,
    longPauseCount: 0,
    longestPause: 0,
    fillerWords: {},
  });

  const recognitionRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const lastSpeechTimeRef = useRef<number>(0);
  const pausesRef = useRef<number[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;

        recognitionRef.current.onresult = (event: any) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript((prev) => {
            // Keep interim logic simple. We append when it's final in real usage, 
            // but for this demo, we'll just track the full text.
            const fullText = Array.from(event.results)
              .map((res: any) => res[0].transcript)
              .join("");
            return fullText;
          });
          
          const now = Date.now();
          if (lastSpeechTimeRef.current > 0) {
            const pauseDuration = (now - lastSpeechTimeRef.current) / 1000;
            if (pauseDuration > 2) { // more than 2 seconds is a long pause
              pausesRef.current.push(pauseDuration);
            }
          }
          lastSpeechTimeRef.current = now;
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
        };
      }
    }
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      setTranscript("");
      setMetrics({
        wordsPerMinute: 0,
        fillerWordCount: 0,
        longPauseCount: 0,
        longestPause: 0,
        fillerWords: {},
      });
      startTimeRef.current = Date.now();
      lastSpeechTimeRef.current = Date.now();
      pausesRef.current = [];
      recognitionRef.current.start();
      setIsListening(true);
    } else {
      alert("Speech recognition is not supported in this browser. Please use Chrome.");
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      
      // Calculate final metrics
      const durationMinutes = (Date.now() - startTimeRef.current) / 60000;
      const words = transcript.trim().split(/\s+/).filter(w => w.length > 0);
      const wpm = durationMinutes > 0 ? Math.round(words.length / durationMinutes) : 0;
      
      const fillerStats: Record<string, number> = {};
      let totalFillers = 0;
      
      const lowerTranscript = transcript.toLowerCase();
      FILLER_WORDS.forEach(filler => {
        // Simple regex to find whole words/phrases
        const regex = new RegExp(`\\b${filler}\\b`, 'g');
        const matches = lowerTranscript.match(regex);
        if (matches) {
          fillerStats[filler] = matches.length;
          totalFillers += matches.length;
        }
      });

      const longPauses = pausesRef.current.filter(p => p >= 3);
      const longestPause = pausesRef.current.length > 0 ? Math.max(...pausesRef.current) : 0;

      setMetrics({
        wordsPerMinute: wpm,
        fillerWordCount: totalFillers,
        fillerWords: fillerStats,
        longPauseCount: longPauses.length,
        longestPause: parseFloat(longestPause.toFixed(1)),
      });
    }
  }, [isListening, transcript]);

  return {
    transcript,
    isListening,
    metrics,
    startListening,
    stopListening,
  };
}
