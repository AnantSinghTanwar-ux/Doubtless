"use client";

import { useState, useEffect, useRef } from "react";
import Button from "@/components/ui/Button";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import type { VivaAnswer } from "@/types";

interface VivaSessionProps {
  topic: string;
  onComplete: (answers: VivaAnswer[]) => void;
  loadingNext: boolean;
  nextQuestion: { question: string; difficulty: number; topic: string } | null;
  onNextRequested: (answers: VivaAnswer[]) => void;
}

export default function VivaSession({ topic, onComplete, loadingNext, nextQuestion, onNextRequested }: VivaSessionProps) {
  const [answers, setAnswers] = useState<VivaAnswer[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [sessionActive, setSessionActive] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  
  const { transcript, isListening, startListening, stopListening, metrics } = useSpeechRecognition();
  
  // Use a synth ref to stop speech if component unmounts or skips
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      synthRef.current = window.speechSynthesis;
    }
    return () => {
      if (synthRef.current) synthRef.current.cancel();
    };
  }, []);

  useEffect(() => {
    if (nextQuestion && sessionActive) {
      speakText(nextQuestion.question);
    }
  }, [nextQuestion, sessionActive]);

  useEffect(() => {
    if (isListening && transcript) {
      setCurrentAnswer(transcript);
    }
  }, [transcript, isListening]);

  const speakText = (text: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    // Find a good English voice
    const voices = synthRef.current.getVoices();
    const preferredVoice = voices.find(v => v.lang.includes('en-GB') || v.lang.includes('en-US'));
    if (preferredVoice) utterance.voice = preferredVoice;
    
    utterance.rate = 0.95; // Slightly slower for clarity
    
    utterance.onend = () => {
      // Auto-start listening after asking the question
      startListening();
    };
    
    synthRef.current.speak(utterance);
  };

  const handleStart = () => {
    setSessionActive(true);
    onNextRequested([]);
  };

  const handleSubmitAnswer = async () => {
    if (!currentAnswer.trim() || !nextQuestion) return;
    
    stopListening();
    if (synthRef.current) synthRef.current.cancel();

    try {
      const res = await fetch("/api/voice/evaluate", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           topic: nextQuestion.question,
           transcript: currentAnswer,
           metrics: metrics,
           chunks: [] // Optionally could pass chunks from parent, but works without
         })
      });
      
      const evalData = await res.json();
      
      const newAnswer: VivaAnswer = {
        question: nextQuestion.question,
        answer: currentAnswer,
        score: evalData.content_accuracy ?? 5,
        feedback: evalData.one_sentence_tip || "Good attempt.",
        confidence: evalData.confidence_score ?? 5,
      };

      const newAnswers = [...answers, newAnswer];
      setAnswers(newAnswers);
      setCurrentAnswer("");
      setQuestionCount(prev => prev + 1);

      if (questionCount + 1 >= 5) {
        setSessionActive(false);
        onComplete(newAnswers);
      } else {
        onNextRequested(newAnswers);
      }
    } catch (error) {
      console.error("Evaluation failed", error);
    }
  };

  if (!sessionActive && questionCount === 0) {
    return (
      <div className="text-center py-12 bg-[#fffdf8]/55 border border-white/[0.06] rounded-2xl p-6">
        <div className="text-5xl mb-4">🤖🗣️</div>
        <h3 className="text-xl font-medium text-white mb-2">Ready for your Viva on {topic}?</h3>
        <p className="text-sm text-gray-400 max-w-md mx-auto mb-8">
          The AI will ask you 5 questions orally. You will answer using your microphone. 
          The AI adapts the difficulty based on your answers.
        </p>
        <Button onClick={handleStart} size="lg" className="rounded-full px-8">Start Viva Session</Button>
      </div>
    );
  }

  return (
    <div className="bg-[#fffdf8]/55 border border-white/[0.06] rounded-2xl p-6">
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/[0.06]">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          Live Examination
        </h3>
        <span className="text-sm text-gray-500 font-medium bg-white/10 px-3 py-1 rounded-full">
          Question {questionCount + 1} of 5
        </span>
      </div>

      {loadingNext ? (
        <div className="py-12 text-center text-blue-400 animate-pulse">
          Generating next adaptive question...
        </div>
      ) : nextQuestion ? (
        <div className="space-y-8">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6 relative">
             <div className="absolute -top-3 left-6 bg-transparent px-2 text-xs text-blue-400 font-bold uppercase tracking-wider">AI Examiner</div>
             <p className="text-lg text-white font-medium leading-relaxed">{nextQuestion.question}</p>
             <button onClick={() => speakText(nextQuestion.question)} className="mt-3 text-xs text-gray-500 hover:text-white flex items-center gap-1">
               <span>🔊</span> Replay Audio
             </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">Your Answer</label>
              {isListening && <span className="text-xs text-red-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> Listening...</span>}
            </div>
            
            <textarea
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              placeholder="Speak your answer, or type it here..."
              className="w-full h-32 p-4 border border-white/[0.06] rounded-xl text-white placeholder-gray-600 focus:ring-1 focus:ring-blue-500 transition-all"
            />
            
            <div className="flex justify-between items-center">
              <Button 
                variant={isListening ? "danger" : "secondary"} 
                onClick={isListening ? stopListening : startListening}
                size="sm"
              >
                {isListening ? "Stop Mic" : "Start Mic"}
              </Button>
              
              <Button onClick={handleSubmitAnswer} disabled={!currentAnswer.trim()}>
                {questionCount === 4 ? "Finish Viva" : "Submit & Next Question"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
