"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useVault } from "@/contexts/VaultContext";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import TopBar from "@/components/layout/TopBar";
import VoiceRecorder from "@/components/voice/VoiceRecorder";
import VoiceReport from "@/components/voice/VoiceReport";
import Loader from "@/components/ui/Loader";
import type { VoiceEvaluation, VoiceMetrics } from "@/types";
import { saveVoiceSession } from "@/lib/firestore";

export default function VoicePage() {
  const { user, profile, loading: authLoading } = useAuth();
  const { selectedVault } = useVault();
  const router = useRouter();

  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [evaluation, setEvaluation] = useState<VoiceEvaluation | null>(null);
  const [metrics, setMetrics] = useState<VoiceMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !profile)) {
      router.replace("/login");
    }
  }, [user, profile, authLoading, router]);

  const handleEvaluationRequest = async (transcript: string, finalMetrics: VoiceMetrics) => {
    if (!user || !topic.trim()) {
      setError("Please enter a topic first.");
      return;
    }
    
    setError(null);
    setEvaluation(null);
    setMetrics(finalMetrics);
    setLoading(true);

    try {
      let chunks: any[] = [];
      if (selectedVault) {
        const searchRes = await fetch("/api/vault/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `Explanation of ${topic}: ${transcript}`,
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

      const evalRes = await fetch("/api/voice/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          transcript,
          metrics: finalMetrics,
          chunks,
        }),
      });

      if (!evalRes.ok) {
        const errData = await evalRes.json();
        throw new Error(errData.error || "Evaluation failed");
      }

      const evalData: VoiceEvaluation = await evalRes.json();
      setEvaluation(evalData);

      // Save to firestore
      await saveVoiceSession({
        userId: user.uid,
        topic,
        transcript,
        metrics: finalMetrics,
        evaluation: evalData,
        createdAt: Date.now(),
      });

      // Update Profile
      const overallScore = Math.round(
        (evalData.content_accuracy + evalData.structure + evalData.clarity + evalData.confidence_score) / 4
      );

      fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          interaction: {
            type: "voice",
            topic: topic,
            outcome: overallScore >= 7 ? "mastered" : "needs_work",
            score: overallScore,
            timestamp: Date.now()
          },
          topicUpdate: {
            topic: topic,
            mastery: overallScore * 10
          }
        })
      }).catch(console.error);

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar />
      <div className="lg:ml-64">
        <TopBar title="Voice Explain Mode" />
        <main className="p-4 md:p-6 pb-24 lg:pb-6 max-w-4xl mx-auto">
          
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-2">Feynman Technique</h2>
            <p className="text-sm text-gray-400 mb-6">
              The best way to test your knowledge is to teach it. Explain a concept aloud, and the AI will analyze your accuracy, clarity, and delivery.
            </p>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">What are you explaining?</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., How Newton's First Law works"
                className="w-full bg-white/[0.03] border-white/[0.06]"
                disabled={loading}
              />
            </div>

            <VoiceRecorder 
              onEvaluationRequest={handleEvaluationRequest} 
              loading={loading}
            />
            {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}
          </div>

          {loading && (
             <div className="py-12">
               <Loader size="lg" text="Analyzing your explanation and voice metrics..." />
             </div>
          )}

          {evaluation && metrics && !loading && (
             <div className="animate-in fade-in slide-up mt-8">
               <h2 className="text-xl font-semibold text-white mb-6">Feynman Analysis</h2>
               <VoiceReport evaluation={evaluation} metrics={metrics} />
             </div>
          )}

        </main>
      </div>
      <BottomNav />
    </div>
  );
}
