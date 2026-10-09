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
import Card from "@/components/ui/Card";
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
        <TopBar title="Adaptive Practice" />
        <main className="p-4 md:p-6 pb-24 lg:pb-6 max-w-4xl mx-auto">
          
          {questions.length === 0 && !loading && (
            <div className="mb-8 animate-in fade-in">
              <h2 className="text-xl font-semibold text-white mb-2">Practice makes perfect</h2>
              <p className="text-sm text-gray-400 mb-6">
                Generate a personalized practice set targeted at your weak spots. The AI adjusts the difficulty based on your past performance.
              </p>
              
              <div className="bg-[#fffdf8]/55 border border-white/[0.06] rounded-2xl p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Topic</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., Algebra"
                    className="w-full bg-[#fffdf8]/75 border-white/[0.06]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Subtopic (Optional)</label>
                  <input
                    type="text"
                    value={subtopic}
                    onChange={(e) => setSubtopic(e.target.value)}
                    placeholder="e.g., Quadratic Equations"
                    className="w-full bg-[#fffdf8]/75 border-white/[0.06]"
                  />
                </div>
                <div className="pt-2">
                  <Button onClick={handleGenerate} disabled={!topic.trim()}>Generate 5 Questions</Button>
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div className="py-12"><Loader text="Generating adaptive questions..." /></div>
          )}

          {questions.length > 0 && !isFinished && (
             <div className="animate-in fade-in">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold text-white">Question {currentIndex + 1} of {questions.length}</h2>
                  <Badge variant="info">Difficulty: {questions[currentIndex].difficulty}/5</Badge>
                </div>

                <Card className="bg-[#fffdf8]/80 mb-6">
                  <p className="text-lg text-white font-medium mb-4">{questions[currentIndex].question}</p>
                  
                  <div className="space-y-2 mt-6">
                    <h4 className="text-xs text-gray-500 uppercase tracking-wider">Hints available:</h4>
                    <ul className="list-disc pl-4 space-y-1">
                      {questions[currentIndex].hints.map((hint, i) => (
                         <li key={i} className="text-sm text-gray-400 opacity-50 hover:opacity-100 transition-opacity cursor-pointer blur-sm hover:blur-none select-none">
                           {hint}
                         </li>
                      ))}
                    </ul>
                  </div>
                </Card>

                {!showFeedback ? (
                  <div className="space-y-4">
                    <textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Type your answer here..."
                      className="w-full h-32 p-4 bg-[#fffdf8]/75 border border-white/[0.06] rounded-xl text-white placeholder-gray-600 focus:ring-1 focus:ring-blue-500"
                      disabled={evaluating}
                    />
                    <div className="flex justify-end">
                      <Button onClick={handleSubmitAnswer} loading={evaluating} disabled={!answer.trim()}>
                        Check Answer
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in slide-up">
                    <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                      results[currentIndex].correct 
                        ? "bg-emerald-500/10 border-emerald-500/30" 
                        : "bg-red-500/10 border-red-500/30"
                    }`}>
                      <span className="text-2xl mt-1">{results[currentIndex].correct ? "✅" : "❌"}</span>
                      <div>
                        <h4 className={`font-medium ${results[currentIndex].correct ? "text-emerald-400" : "text-red-400"}`}>
                          {results[currentIndex].correct ? "Correct!" : "Incorrect"}
                        </h4>
                        <p className="text-sm text-gray-300 mt-2 leading-relaxed">
                          {results[currentIndex].feedback}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={handleNext}>
                        {currentIndex + 1 === questions.length ? "Finish Practice" : "Next Question"}
                      </Button>
                    </div>
                  </div>
                )}
             </div>
          )}

          {isFinished && (
             <div className="text-center py-12 animate-in slide-up">
               <span className="text-6xl mb-4 block">🏆</span>
               <h2 className="text-2xl font-bold text-white mb-2">Practice Complete!</h2>
               <p className="text-gray-400 mb-8">
                 You scored an average of <strong className="text-white">{(results.reduce((s, r) => s + r.score, 0) / results.length).toFixed(1)}/10</strong> across 5 questions.
                 Your mastery profile has been updated.
               </p>
               <div className="flex justify-center gap-4">
                 <Button variant="secondary" onClick={() => router.push("/dashboard")}>Back to Dashboard</Button>
                 <Button onClick={() => handleGenerate()}>Practice Again</Button>
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
    <Suspense fallback={<div className="min-h-screen bg-transparent flex items-center justify-center">Loading...</div>}>
      <PracticeContent />
    </Suspense>
  );
}
