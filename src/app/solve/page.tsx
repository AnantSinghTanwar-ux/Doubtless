"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useVault } from "@/contexts/VaultContext";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import TopBar from "@/components/layout/TopBar";
import StepEditor from "@/components/solve/StepEditor";
import EvaluationResult from "@/components/solve/EvaluationResult";
import Loader from "@/components/ui/Loader";
import type { SolutionEvaluation } from "@/types";
import { saveEvaluation } from "@/lib/firestore";

export default function SolvePage() {
  const { user, profile, loading: authLoading } = useAuth();
  const { selectedVault } = useVault();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [evaluation, setEvaluation] = useState<SolutionEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !profile)) {
      router.replace("/login");
    }
  }, [user, profile, authLoading, router]);

  const handleEvaluate = async (payload: any) => {
    if (!user) return;
    setError(null);
    setEvaluation(null);
    setLoading(true);

    try {
      let chunks: any[] = [];
      if (selectedVault) {
        const searchRes = await fetch("/api/vault/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: payload.question,
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

      const evalRes = await fetch("/api/solve/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          chunks,
          vaultFileName: selectedVault?.fileName,
        }),
      });

      if (!evalRes.ok) {
        const errData = await evalRes.json();
        throw new Error(errData.error || "Evaluation failed");
      }

      const evalData: SolutionEvaluation = await evalRes.json();
      setEvaluation(evalData);

      // Save to firestore
      await saveEvaluation({
        userId: user.uid,
        question: payload.question,
        studentSolution: payload.steps || (payload.imageBase64 ? ["Uploaded Image"] : []),
        evaluation: evalData,
        vaultId: selectedVault?.id,
        createdAt: Date.now(),
      });

      // Update Profile (if not perfect, log the error types)
      if (evalData.first_error_step !== null) {
        const errorStep = evalData.steps.find(s => s.step === evalData.first_error_step);
        if (errorStep && errorStep.error_type) {
           fetch("/api/profile/update", {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({
               userId: user.uid,
               mistakeUpdate: { type: errorStep.error_type, count: 1 },
               interaction: {
                 type: "evaluation",
                 topic: "Math/Logic", // generic since we don't have topic routing here
                 outcome: "needs_work",
                 score: evalData.rubric.total,
                 timestamp: Date.now()
               }
             })
           }).catch(console.error);
        }
      }

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitSteps = (question: string, steps: string[]) => {
    handleEvaluate({ question, steps });
  };

  const handleSubmitImage = (question: string, imageBase64: string, mimeType: string) => {
    handleEvaluate({ question, imageBase64, imageMimeType: mimeType });
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar />
      <div className="lg:ml-64">
        <TopBar title="Step-by-Step Solver" />
        <main className="p-4 md:p-6 pb-24 lg:pb-6 max-w-4xl mx-auto">
          
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-2">Check your work</h2>
            <p className="text-sm text-gray-400 mb-6">
              Write your solution step-by-step or upload a photo of your notebook. Our AI will analyze your method and pinpoint exactly where you went wrong.
            </p>
            
            <div className="bg-[#fffdf8]/55 border border-white/[0.06] rounded-2xl p-6">
              <StepEditor 
                onSubmitSteps={handleSubmitSteps} 
                onSubmitImage={handleSubmitImage}
                loading={loading}
              />
              {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}
            </div>
          </div>

          {loading && (
             <div className="py-12">
               <Loader size="lg" text="Meticulously analyzing your solution..." />
             </div>
          )}

          {evaluation && !loading && (
             <div className="animate-in fade-in slide-up mt-8">
               <h2 className="text-xl font-semibold text-white mb-6">Evaluation Results</h2>
               <EvaluationResult evaluation={evaluation} />
             </div>
          )}

        </main>
      </div>
      <BottomNav />
    </div>
  );
}
