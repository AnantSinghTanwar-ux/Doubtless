"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useVault } from "@/contexts/VaultContext";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import TopBar from "@/components/layout/TopBar";
import Loader from "@/components/ui/Loader";
import VivaSession from "@/components/viva/VivaSession";
import VivaReportDisplay from "@/components/viva/VivaReport";
import type { VivaReport, VivaAnswer } from "@/types";
import { saveVivaRecord } from "@/lib/firestore";
import Button from "@/components/ui/Button";

export default function VivaPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const { selectedVault } = useVault();
  const router = useRouter();

  const [topic, setTopic] = useState("");
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [nextQuestion, setNextQuestion] = useState<{ question: string; difficulty: number; topic: string } | null>(null);
  const [report, setReport] = useState<VivaReport | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !profile)) {
      router.replace("/login");
    }
  }, [user, profile, authLoading, router]);

  const handleNextRequested = async (answers: VivaAnswer[]) => {
    setLoadingQuestion(true);
    try {
      let chunks: any[] = [];
      if (selectedVault) {
        const searchRes = await fetch("/api/vault/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: topic + (answers.length > 0 ? " " + answers[answers.length - 1].answer : ""),
            vaultId: selectedVault.id,
            fileName: selectedVault.fileName,
            topK: 3,
          }),
        });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          chunks = searchData.chunks || [];
        }
      }

      const res = await fetch("/api/viva/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          previousAnswers: answers,
          chunks,
          questionNumber: answers.length + 1
        })
      });

      if (res.ok) {
        const data = await res.json();
        setNextQuestion(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingQuestion(false);
    }
  };

  const handleComplete = async (answers: VivaAnswer[]) => {
    if (!user) return;
    setLoadingReport(true);
    setNextQuestion(null);

    try {
      const res = await fetch("/api/viva/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, answers })
      });

      if (res.ok) {
        const data: VivaReport = await res.json();
        setReport(data);

        await saveVivaRecord({
          userId: user.uid,
          topic,
          report: data,
          vaultId: selectedVault?.id,
          createdAt: Date.now()
        });

        // Update profile
        fetch("/api/profile/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.uid,
            interaction: {
              type: "viva",
              topic: topic,
              outcome: data.overall_score >= 7 ? "mastered" : "needs_work",
              score: data.overall_score,
              timestamp: Date.now()
            },
            topicUpdate: {
              topic: topic,
              mastery: data.overall_score * 10
            }
          })
        }).catch(console.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReport(false);
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar />
      <div className="lg:ml-64">
        <TopBar title="AI Viva Mode" />
        <main className="p-4 md:p-6 pb-24 lg:pb-6 max-w-4xl mx-auto">
          
          {!report && !nextQuestion && !loadingQuestion && (
            <div className="mb-8 animate-in fade-in">
              <h2 className="text-xl font-semibold text-white mb-2">Oral Examination</h2>
              <p className="text-sm text-gray-400 mb-6">
                Test your knowledge under pressure. The AI examiner will ask you 5 questions, adapting to your answers in real-time.
              </p>
              
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">What topic do you want to be examined on?</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., Photosynthesis"
                    className="flex-1 bg-white/[0.03] border-white/[0.06]"
                  />
                  <Button onClick={() => handleNextRequested([])} disabled={!topic.trim()}>
                    Start Viva
                  </Button>
                </div>
              </div>
            </div>
          )}

          {(nextQuestion || loadingQuestion) && !report && (
             <VivaSession 
                topic={topic}
                onComplete={handleComplete}
                loadingNext={loadingQuestion}
                nextQuestion={nextQuestion}
                onNextRequested={handleNextRequested}
             />
          )}

          {loadingReport && (
             <div className="py-12 flex flex-col items-center">
               <Loader size="lg" text="Analyzing your performance and generating report..." />
             </div>
          )}

          {report && !loadingReport && (
             <div className="animate-in fade-in slide-up">
               <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xl font-semibold text-white">Viva Examination Report</h2>
                 <Button variant="ghost" onClick={() => { setReport(null); setTopic(""); }}>Take another Viva</Button>
               </div>
               <VivaReportDisplay report={report} />
             </div>
          )}

        </main>
      </div>
      <BottomNav />
    </div>
  );
}
