"use client";

import { useState, useEffect, type ComponentProps } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useVault } from "@/contexts/VaultContext";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import TopBar from "@/components/layout/TopBar";
import DoubtInput from "@/components/doubt/DoubtInput";
import RouteCard from "@/components/doubt/RouteCard";
import RecommendedTeachers from "@/components/doubt/RecommendedTeachers";
import { needsExpert } from "@/lib/teacherRanking";
import AiExplanation from "@/components/doubt/AiExplanation";
import Loader from "@/components/ui/Loader";
import Button from "@/components/ui/Button";
import type { DoubtRouterResult, RetrievedChunk } from "@/types";
import type { RecalledMemory } from "@/lib/memory";
import { BookOpen, History } from "lucide-react";

export default function AskPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const { selectedVault } = useVault();
  const router = useRouter();

  const [question, setQuestion] = useState("");
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [routeResult, setRouteResult] = useState<DoubtRouterResult | null>(null);
  const [explanation, setExplanation] = useState<ComponentProps<typeof AiExplanation>["explanation"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contextChunks, setContextChunks] = useState<unknown[]>([]);
  const [memories, setMemories] = useState<Pick<RecalledMemory, "kind" | "topic" | "text" | "at">[]>([]);

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
    setMemories([]);
    setContextChunks([]);
    setLoadingRoute(true);

    try {
      // 1. Retrieval: the most relevant passages from ALL of the student's uploaded notes (the selected one preferred).
      //    The explanation step adds their own related past doubts, sessions and vivas.
      let chunks: RetrievedChunk[] = [];
      const searchRes = await fetch("/api/vault/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, scope: "all", vaultId: selectedVault?.id, topK: 5 }),
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        chunks = searchData.chunks || [];
      }
      // 2. Route the doubt
      const routeRes = await fetch("/api/doubt/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          chunks,
          profile,
          recentInteractions: (profile as { recentInteractions?: unknown[] }).recentInteractions || [],
        }),
      });

      if (!routeRes.ok) {
        const errData = await routeRes.json();
        throw new Error(errData.error || "Routing failed");
      }

      setContextChunks(chunks);
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
        setMemories(explainData.memories ?? []);
        setLoadingExplain(false);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoadingRoute(false);
      setLoadingExplain(false);
    }
  };

  /** For doubts routed to a teacher: get the AI explanation anyway (useful while nobody suitable is online). */
  const handleAiInstead = async () => {
    if (!routeResult) return;
    setError(null);
    setLoadingExplain(true);
    try {
      const res = await fetch("/api/doubt/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, chunks: contextChunks, routerResult: routeResult }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Explanation failed");
      const data = await res.json();
      setExplanation(data);
      setMemories(data.memories ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoadingExplain(false);
    }
  };

  const handlePractice = () => {
    router.push(`/practice?topic=${encodeURIComponent(routeResult?.topic || "")}&subtopic=${encodeURIComponent(routeResult?.subtopic || "")}`);
  };

  const handleTeacher = () => {
    const r = routeResult;
    const params = new URLSearchParams({ topic: r?.topic || "", subtopic: r?.subtopic || "", difficulty: r?.difficulty || "", type: r?.doubt_type || "", confidence: String(r?.confidence ?? ""), grade: String(r?.grade_level ?? ""), q: question.slice(0, 300) });
    router.push(`/teachers?${params}`);
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar />
      <div className="lg:ml-64">
        <TopBar title="Ask Doubt" />
        <main id="main" className="mx-auto max-w-6xl p-4 pb-24 md:p-6 md:pb-24 lg:pb-8 [&>*]:max-w-4xl">
          <div className="mb-8">
            <h2 className="display text-2xl text-ink mb-2">What are you struggling with?</h2>
            <p className="text-sm text-muted mb-6">
              Ask in your own words. Sθlvε picks the fastest help: an AI explanation, practice, or a live teacher.
            </p>
            <DoubtInput onSubmit={handleSubmit} loading={loadingRoute || loadingExplain} />
            {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
          </div>

          <div className="space-y-8 mt-8">
            {loadingRoute && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader size="lg" text="Working out why you are stuck..." />
              </div>
            )}

            {routeResult && !loadingRoute && (
              <div className="animate-in fade-in slide-up">
                <RouteCard result={routeResult} />
              </div>
            )}

            {routeResult && !loadingRoute && (contextChunks.length > 0 || memories.length > 0) && (
              <div className="rounded-card border border-line bg-sheet p-4 text-sm">
                <p className="mb-2 font-medium text-ink">Personalised with your own material</p>
                {contextChunks.length > 0 && (
                  <p className="flex items-start gap-2 text-muted">
                    <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-pen" aria-hidden />
                    <span>
                      From your notes:{" "}
                      {[...new Map((contextChunks as RetrievedChunk[]).map((c) => [`${c.fileName}#${c.pageNumber}`, c])).values()]
                        .slice(0, 4)
                        .map((c) => `${c.fileName} p.${c.pageNumber}`)
                        .join(" · ")}
                    </span>
                  </p>
                )}
                {memories.length > 0 && (
                  <div className="mt-2 flex items-start gap-2 text-muted">
                    <History className="mt-0.5 h-4 w-4 shrink-0 text-pen" aria-hidden />
                    <ul className="space-y-1">
                      {memories.map((m) => (
                        <li key={`${m.at}-${m.kind}`}>
                          You {m.kind === "doubt" ? "asked" : m.kind === "session" ? "had a teacher session on" : m.kind === "viva" ? "took a viva on" : "practised"}{" "}
                          <span className="text-ink">&ldquo;{m.text.slice(0, 90)}{m.text.length > 90 ? "…" : ""}&rdquo;</span> on {new Date(m.at).toLocaleDateString()}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {loadingExplain && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader size="md" text="Writing an explanation for you..." />
              </div>
            )}

            {explanation && !loadingExplain && (
              <div className="animate-in fade-in slide-up" style={{ animationDelay: "150ms" }}>
                <AiExplanation explanation={explanation} />
                
                <div className={routeResult?.route === "ai_explain" ? "mt-8 flex justify-center" : "hidden"}>
                  <Button onClick={handlePractice} variant="secondary" className="mr-4">
                    Try a quick practice set
                  </Button>
                  <Button onClick={handleTeacher} variant="ghost">
                    Still confused? Talk to a teacher
                  </Button>
                </div>
              </div>
            )}

            {routeResult && routeResult.route === "practice" && !loadingRoute && (
               <div className="mt-8 flex justify-center animate-in fade-in slide-up">
                 <Button onClick={handlePractice} size="lg">Start practising</Button>
               </div>
            )}

            {routeResult && needsExpert(routeResult) && !loadingRoute && (
              <div className="animate-in fade-in slide-up" style={{ animationDelay: "250ms" }}>
                <RecommendedTeachers
                  routerResult={routeResult}
                  question={question}
                  onTryAi={routeResult.route === "teacher" ? () => void handleAiInstead() : undefined}
                />
              </div>
            )}
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
