"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, Library } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getVaultDocuments } from "@/lib/firestore";
import type { VaultDocument } from "@/types";
import ReactMarkdown from "react-markdown";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import TopBar from "@/components/layout/TopBar";
import Button from "@/components/ui/Button";
import Empty from "@/components/ui/Empty";
import Loader from "@/components/ui/Loader";
import { cn } from "@/lib/utils";

export default function SamplePaperPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [vaults, setVaults] = useState<VaultDocument[]>([]);
  const [selectedVaults, setSelectedVaults] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [paper, setPaper] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !profile)) router.replace("/login");
  }, [user, profile, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchVaults = async () => {
      try {
        const data = await getVaultDocuments(user.uid);
        setVaults(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchVaults();
  }, [user]);

  const toggleVault = (id: string) => {
    setSelectedVaults((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const generatePaper = async () => {
    if (selectedVaults.length === 0) return;
    setGenerating(true);
    setPaper(null);
    try {
      const response = await fetch("/api/practice/sample-paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaultIds: selectedVaults }),
      });
      if (!response.ok) throw new Error("Failed to generate paper");
      const data = await response.json();
      setPaper(data.paper);
    } catch (error) {
      console.error(error);
      alert("Failed to generate sample paper");
    } finally {
      setGenerating(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar />
      <div className="lg:ml-64">
        <TopBar title="Sample Paper" />
        <main id="main" className="mx-auto max-w-6xl p-4 pb-24 md:p-6 md:pb-24 lg:pb-8 [&>*]:max-w-4xl">
          {!paper ? (
            <div className="animate-in">
              <h2 className="display mb-2 text-2xl text-ink">Build a mock paper from your material</h2>
              <p className="mb-6 text-muted">Choose previous year papers or notes from your vault. Sθlvε writes a paper with the questions most likely to come up.</p>

              <div className="space-y-6 rounded-card border border-line bg-sheet p-5 shadow-sheet sm:p-6">
                {loading ? (
                  <Loader text="Loading your vault..." />
                ) : vaults.length === 0 ? (
                  <Empty
                    icon={<Library />}
                    title="Your vault is empty"
                    description="Upload previous year papers or notes first, then come back to build a paper from them."
                    action={<Button onClick={() => router.push("/vault")}>Go to the Study Vault</Button>}
                  />
                ) : (
                  <fieldset>
                    <legend className="mb-3 text-sm font-medium text-ink">Reference material</legend>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {vaults.map((vault) => {
                        const on = selectedVaults.includes(vault.id!);
                        return (
                          <label
                            key={vault.id}
                            className={cn(
                              "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-pen",
                              on ? "border-pen bg-pen-wash" : "border-line bg-sheet hover:border-line-strong"
                            )}
                          >
                            <input type="checkbox" checked={on} onChange={() => toggleVault(vault.id!)} className="sr-only" />
                            <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border", on ? "border-pen bg-pen text-snow" : "border-line-strong bg-sheet")} aria-hidden>
                              {on && <Check className="h-3.5 w-3.5" />}
                            </span>
                            <span className="min-w-0">
                              <span className="line-clamp-1 block font-medium text-ink">{vault.fileName}</span>
                              <span className="tabular mt-1 block text-xs text-muted">
                                {vault.pageCount} pages, {vault.chunkCount} chunks
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                )}

                {vaults.length > 0 && (
                  <div className="flex justify-end border-t border-line pt-4">
                    <Button onClick={generatePaper} disabled={selectedVaults.length === 0} loading={generating}>
                      {generating ? "Writing your paper..." : "Generate sample paper"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="animate-in space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="display text-2xl text-ink">Your sample paper</h2>
                <Button variant="secondary" onClick={() => setPaper(null)}>
                  Make another
                </Button>
              </div>
              <div className="paper paper-plain px-6 py-8 sm:px-10">
                <div className="serif text-[16px] leading-[1.85] text-[#1b2440] [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-semibold [&_hr]:my-5 [&_hr]:border-[#1b2440]/20 [&_li]:ml-6 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:mb-3 [&_strong]:font-semibold">
                  <ReactMarkdown>{paper}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
