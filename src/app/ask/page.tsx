"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useVault } from "@/contexts/VaultContext";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import TopBar from "@/components/layout/TopBar";
import DoubtInput from "@/components/doubt/DoubtInput";
import RouteCard from "@/components/doubt/RouteCard";
import AiExplanation from "@/components/doubt/AiExplanation";
import Loader from "@/components/ui/Loader";
import Button from "@/components/ui/Button";
import type { DoubtRouterResult } from "@/types";

export default function AskPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const { selectedVault } = useVault();
  const router = useRouter();

  const [question, setQuestion] = useState("");
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [routeResult, setRouteResult] = useState<DoubtRouterResult | null>(null);
  const [explanation, setExplanation] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !profile)) {
      router.replace("/login");
    }
  }, [user, profile, authLoading, router]);

  const handleSubmit = async (q: string) => {
    if (!user || !profile) return;
    setQuestion(q);
    setError(null);
    setRouteResult(null);
    setExplanation(null);
    setLoadingRoute(true);

    try {
      // 1. Get context chunks if a vault is selected
      let chunks: any[] = [];
      if (selectedVault) {
        const searchRes = await fetch("/api/vault/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: q,
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

      // 2. Route the doubt
      const routeRes = await fetch("/api/doubt/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          chunks,
          profile,
          recentInteractions: (profile as any).recentInteractions || [],
        }),
      });

      if (!routeRes.ok) {
        const errData = await routeRes.json();
        throw new Error(errData.error || "Routing failed");
      }

      const routerResult: DoubtRouterResult = await routeRes.json();
      setRouteResult(routerResult);
      setLoadingRoute(false);

      // 3. If routed to AI explain, fetch explanation
      if (routerResult.route === "ai_explain") {
        setLoadingExplain(true);
        const explainRes = await fetch("/api/doubt/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: q,
            chunks,
            routerResult,
          }),
        });

        if (!explainRes.ok) {
          const errData = await explainRes.json();
          throw new Error(errData.error || "Explanation failed");
        }

        const explainData = await explainRes.json();
        setExplanation(explainData);
        setLoadingExplain(false);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoadingRoute(false);
      setLoadingExplain(false);
    }
  };

  const handlePractice = () => {
    router.push(`/practice?topic=${encodeURIComponent(routeResult?.topic || "")}&subtopic=${encodeURIComponent(routeResult?.subtopic || "")}`);
  };

  const handleTeacher = () => {
    router.push(`/teachers?topic=${encodeURIComponent(routeResult?.topic || "")}`);
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar />
      <div className="lg:ml-64">
        <TopBar title="Ask Doubt" />
        <main className="p-4 md:p-6 pb-24 lg:pb-6 max-w-4xl mx-auto">
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-2">What are you struggling with?</h2>
            <p className="text-sm text-gray-400 mb-6">
              Ask your doubt and our Intelligent Router will find the best way to help you: AI explanation, adaptive practice, or a live teacher.
            </p>
            <DoubtInput onSubmit={handleSubmit} loading={loadingRoute || loadingExplain} />
            {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
          </div>

          <div className="space-y-8 mt-8">
            {loadingRoute && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader size="lg" text="Analyzing your doubt and finding the best route..." />
              </div>
            )}

            {routeResult && !loadingRoute && (
              <div className="animate-in fade-in slide-up">
                <RouteCard result={routeResult} />
              </div>
            )}

            {loadingExplain && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader size="md" text="Generating personalized explanation based on your profile..." />
              </div>
            )}

            {explanation && !loadingExplain && routeResult?.route === "ai_explain" && (
              <div className="animate-in fade-in slide-up" style={{ animationDelay: "150ms" }}>
                <AiExplanation explanation={explanation} />
                
                <div className="mt-8 flex justify-center">
                  <Button onClick={handlePractice} variant="secondary" className="mr-4">
                    Take a Quick Practice
                  </Button>
                  <Button onClick={handleTeacher} variant="ghost">
                    Still confused? Talk to a Teacher
                  </Button>
                </div>
              </div>
            )}

            {routeResult && routeResult.route === "practice" && !loadingRoute && (
               <div className="mt-8 flex justify-center animate-in fade-in slide-up">
                 <Button onClick={handlePractice} size="lg">Start Adaptive Practice</Button>
               </div>
            )}

            {routeResult && routeResult.route === "teacher" && !loadingRoute && (
               <div className="mt-8 flex justify-center animate-in fade-in slide-up">
                 <Button onClick={handleTeacher} size="lg">Find an Expert Teacher</Button>
               </div>
            )}
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
