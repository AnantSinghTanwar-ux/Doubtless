"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getVaultDocuments } from "@/lib/firestore";
import type { VaultDocument } from "@/types";
import { Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function SamplePaperPage() {
  const { user } = useAuth();
  const [vaults, setVaults] = useState<VaultDocument[]>([]);
  const [selectedVaults, setSelectedVaults] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [paper, setPaper] = useState<string | null>(null);

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

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">Sample Paper Generator</h1>
        <p className="text-gray-400">
          Select multiple previous year papers or notes from your vault to generate a highly probable sample paper.
        </p>
      </header>

      {!paper ? (
        <div className="bg-[#fffdf8] border border-[#e2d9c6] rounded-2xl p-6 space-y-6 shadow-xl">
          <h2 className="text-xl font-semibold text-white">Select Reference Material</h2>
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : vaults.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              No vaults found. Upload some previous year papers in the Study Vault first!
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {vaults.map((vault) => (
                <div
                  key={vault.id}
                  onClick={() => toggleVault(vault.id!)}
                  className={`p-4 rounded-xl cursor-pointer border transition-all duration-200 flex items-start gap-3 ${
                    selectedVaults.includes(vault.id!)
                      ? "bg-blue-500/10 border-blue-500/50"
                      : "bg-[#fffdf8]/55 border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border mt-0.5 ${
                    selectedVaults.includes(vault.id!) ? "bg-blue-500 border-blue-500" : "border-white/20"
                  }`}>
                    {selectedVaults.includes(vault.id!) && <span className="text-white text-xs">✓</span>}
                  </div>
                  <div>
                    <h3 className="text-white font-medium line-clamp-1">{vault.fileName}</h3>
                    <p className="text-xs text-gray-400 mt-1">{vault.pageCount} pages • {vault.chunkCount} chunks</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 flex justify-end">
            <button
              onClick={generatePaper}
              disabled={selectedVaults.length === 0 || generating}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-snow font-medium rounded-xl hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {generating && <Loader2 className="w-4 h-4 animate-spin" />}
              {generating ? "Analyzing & Generating..." : "Generate Sample Paper"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">Your Generated Sample Paper</h2>
            <button
              onClick={() => setPaper(null)}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors text-sm font-medium"
            >
              Generate Another
            </button>
          </div>
          <div className="bg-[#fffdf8] border border-[#e2d9c6] rounded-2xl p-8 shadow-xl prose prose-invert max-w-none">
            <ReactMarkdown>{paper}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
