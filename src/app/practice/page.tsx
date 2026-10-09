"use client";

import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useVault } from "@/contexts/VaultContext";
import { useRouter, useSearchParams } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import TopBar from "@/components/layout/TopBar";
import Loader from "@/components/ui/Loader";
import Button from "@/components/ui/Button";
import Callout from "@/components/ui/Callout";
import Card from "@/components/ui/Card";
import { CheckCircle2, Trophy, XCircle } from "lucide-react";
import Badge from "@/components/ui/Badge";
import type { PracticeQuestion, PracticeSet } from "@/types";
import { savePracticeSet } from "@/lib/firestore";

function PracticeContent() {
  const { user, profile, loading: authLoading } = useAuth();
  const { selectedVault } = useVault();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const initialTopic = searchParams.get("topic") || "";
  const initialSubtopic = searchParams.get("subtopic") || "";

  const [topic, setTopic] = useState(initialTopic);
  const [subtopic, setSubtopic] = useState(initialSubtopic);
  
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  
  const [results, setResults] = useState<Array<{ questionIndex: number, answer: string, correct: boolean, feedback: string, score: number }>>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !profile)) {
      router.replace("/login");
    }
  }, [user, profile, authLoading, router]);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setQuestions([]);
    setResults([]);
    setCurrentIndex(0);
    setIsFinished(false);

    try {
      let chunks: any[] = [];
      if (selectedVault) {
        const searchRes = await fetch("/api/vault/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `${topic} ${subtopic} practice questions`,
            vaultId: selectedVault.id,
            fileName: selectedVault.fileName,
            topK: 5,
          }),
        });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          chunks = searchData.chunks || [];
        }
      }

      const res = await fetch("/api/practice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          topic,
          subtopic,
          profile,
          chunks
        })
      });

      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!answer.trim() || !user) return;
    setEvaluating(true);
    
    try {
      const currentQ = questions[currentIndex];
      const res = await fetch("/api/practice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "evaluate",
          question: currentQ,
          answer
        })
      });

      if (res.ok) {
        const data = await res.json();
        const newResult = {
          questionIndex: currentIndex,
          answer,
          correct: data.correct,
          feedback: data.feedback,
          score: data.score
        };
        
        setResults([...results, newResult]);
        setShowFeedback(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEvaluating(false);
    }
  };

  const handleNext = async () => {
    setShowFeedback(false);
    setAnswer("");
    
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Finish
      setIsFinished(true);
      
      const totalScore = results.reduce((sum, r) => sum + r.score, 0);
      const avgScore = totalScore / results.length;
      
      if (user) {
        // Save to DB
        await savePracticeSet({
          userId: user.uid,
          topic,
          subtopic,
          questions,
          answers: results,
          score: avgScore,
          createdAt: Date.now()
        });

        // Update profile
        fetch("/api/profile/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.uid,
            interaction: {
              type: "practice",
              topic: topic,
              subtopic: subtopic,
              outcome: avgScore >= 7 ? "mastered" : "needs_work",
              score: avgScore,
              timestamp: Date.now()
            },
            topicUpdate: {
              topic: topic,
              mastery: avgScore * 10
            }
          })
        }).catch(console.error);
      }
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar />
      <div className="lg:ml-64">
        <TopBar title="Practice" />
        <main id="main" className="mx-auto max-w-6xl p-4 pb-24 md:p-6 md:pb-24 lg:pb-8 [&>*]:max-w-4xl">
          
          {questions.length === 0 && !loading && (
            <div className="mb-8 animate-in fade-in">
              <h2 className="display text-2xl text-ink mb-2">Practise what you keep missing</h2>
              <p className="text-sm text-muted mb-6">
                Get a set of 5 questions aimed at your weak spots. The difficulty adapts to how you have been doing.
              </p>
              
              <div className="rounded-card border border-line bg-sheet p-5 shadow-sheet sm:p-6 space-y-4">
                <div>
                  <label htmlFor="practice-topic" className="mb-2 block text-sm font-medium text-ink">Topic</label>
                  <input
                    id="practice-topic"
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., Algebra"
                    className="w-full"
                  />
                </div>
                <div>
                  <label htmlFor="practice-subtopic" className="mb-2 block text-sm font-medium text-ink">Subtopic <span className="font-normal text-faint">(optional)</span></label>
                  <input
                    id="practice-subtopic"
                    type="text"
                    value={subtopic}
                    onChange={(e) => setSubtopic(e.target.value)}
                    placeholder="e.g., Quadratic Equations"
                    className="w-full"
                  />
                </div>
                <div className="pt-2">
                  <Button onClick={handleGenerate} disabled={!topic.trim()}>Generate 5 questions</Button>
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div className="py-12"><Loader text="Writing questions for you..." /></div>
          )}

          {questions.length > 0 && !isFinished && (
             <div className="animate-in fade-in">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="font-display text-xl font-semibold text-ink">Question {currentIndex + 1} of {questions.length}</h2>
                  <Badge variant="info">Difficulty: {questions[currentIndex].difficulty}/5</Badge>
                </div>

                <Card className="mb-6">
                  <p className="mb-4 font-display text-xl font-medium leading-relaxed text-ink">{questions[currentIndex].question}</p>
                  
                  {questions[currentIndex].hints.length > 0 && (
                    <details className="group mt-6 rounded-xl border border-line bg-paper px-4 py-3">
                      <summary className="cursor-pointer text-sm font-medium text-pen-deep">Need a hint?</summary>
                      <ul className="mt-3 list-disc space-y-1 pl-5">
                        {questions[currentIndex].hints.map((hint, i) => (
                          <li key={i} className="text-sm text-muted">
                            {hint}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </Card>

                {!showFeedback ? (
                  <div className="space-y-4">
                    <textarea
                      value={answer}
                      aria-label="Your answer"
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Type your answer here..."
                      className="h-32 w-full p-4"
                      disabled={evaluating}
                    />
                    <div className="flex justify-end">
                      <Button onClick={handleSubmitAnswer} loading={evaluating} disabled={!answer.trim()}>
                        Check my answer
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in slide-up">
                    <Callout tone={results[currentIndex].correct ? "success" : "error"} icon={results[currentIndex].correct ? CheckCircle2 : XCircle} title={results[currentIndex].correct ? "Correct" : "Not quite"}>
                      <p className="leading-relaxed">{results[currentIndex].feedback}</p>
                    </Callout>
                    <div className="flex justify-end">
                      <Button onClick={handleNext}>
                        {currentIndex + 1 === questions.length ? "Finish the set" : "Next question"}
                      </Button>
                    </div>
                  </div>
                )}
             </div>
          )}

          {isFinished && (
             <div className="text-center py-12 animate-in slide-up">
               <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-pen/10 text-pen">
                 <Trophy className="h-8 w-8" aria-hidden />
               </span>
               <h2 className="display mb-2 text-3xl text-ink">Set complete</h2>
               <p className="text-muted mb-8">
                 You scored an average of <strong className="text-ink">{(results.reduce((s, r) => s + r.score, 0) / results.length).toFixed(1)}/10</strong> across 5 questions.
                 Your mastery profile has been updated.
               </p>
               <div className="flex justify-center gap-4">
                 <Button variant="secondary" onClick={() => router.push("/dashboard")}>Back to the dashboard</Button>
                 <Button onClick={() => handleGenerate()}>Practise again</Button>
               </div>
             </div>
          )}

        </main>
      </div>
      <BottomNav />
    </div>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader size="lg" /></div>}>
      <PracticeContent />
    </Suspense>
  );
}
