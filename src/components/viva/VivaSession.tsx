"use client";

import { useState, useEffect, useRef } from "react";
import { GraduationCap, Volume2 } from "lucide-react";
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
      <div className="rounded-card border border-line bg-sheet p-6 py-12 text-center shadow-sheet">
        <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-pen/10 text-pen">
          <GraduationCap className="h-8 w-8" aria-hidden />
        </span>
        <h3 className="mb-2 font-display text-2xl font-semibold text-ink">Ready for your viva on {topic}?</h3>
        <p className="text-sm text-muted max-w-md mx-auto mb-8">
          You will hear 5 questions and answer them with your microphone. The difficulty adapts to how well you answer.
        </p>
        <Button onClick={handleStart} size="lg" className="px-8">Start the viva</Button>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-line bg-sheet p-6 shadow-sheet">
      <div className="mb-8 flex items-center justify-between border-b border-line pb-4">
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
          <span className="h-2 w-2 animate-pulse rounded-full bg-margin" aria-hidden />
          Live exam
        </h3>
        <span className="tabular rounded-full bg-ink/[0.07] px-3 py-1 text-sm font-medium text-muted">
          Question {questionCount + 1} of 5
        </span>
      </div>

      {loadingNext ? (
        <div className="animate-pulse py-12 text-center text-pen" role="status">
          Preparing your next question...
        </div>
      ) : nextQuestion ? (
        <div className="space-y-8">
          <div className="rounded-card border border-pen/25 bg-pen-wash p-6">
             <p className="mb-2 text-sm font-medium text-pen-deep">Examiner</p>
             <p className="font-display text-xl font-medium leading-relaxed text-ink">{nextQuestion.question}</p>
             <button onClick={() => speakText(nextQuestion.question)} className="mt-3 flex items-center gap-1.5 text-sm text-muted hover:text-ink">
               <Volume2 className="h-4 w-4" aria-hidden /> Hear it again
             </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label htmlFor="viva-answer" className="text-sm font-medium text-ink">Your answer</label>
              {isListening && (
                <span className="flex items-center gap-1.5 text-sm text-margin" role="status">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-margin" aria-hidden /> Listening...
                </span>
              )}
            </div>
            
            <textarea
              id="viva-answer"
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              placeholder="Speak your answer, or type it here..."
              className="h-32 w-full p-4"
            />
            
            <div className="flex justify-between items-center">
              <Button 
                variant={isListening ? "danger" : "secondary"} 
                onClick={isListening ? stopListening : startListening}
                size="sm"
              >
                {isListening ? "Stop the mic" : "Use the mic"}
              </Button>
              
              <Button onClick={handleSubmitAnswer} disabled={!currentAnswer.trim()}>
                {questionCount === 4 ? "Finish the viva" : "Submit and continue"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
