"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ArrowLeft, ArrowRight, FileText, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { getVaultFolders, getVaultDocuments } from "@/lib/firestore";
import type { VaultFolder, VaultDocument } from "@/types";

interface ChunkData {
  text: string;
  pageNumber: number;
}

export default function CoWorkPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [vaults, setVaults] = useState<VaultDocument[]>([]);
  const [selectedVault, setSelectedVault] = useState<VaultDocument | null>(null);
  const [chunks, setChunks] = useState<ChunkData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<Record<number, { summary: string; highlightKeyword: string }>>({});
  const [analyzingStates, setAnalyzingStates] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const [f, d] = await Promise.all([
          getVaultFolders(user.uid),
          getVaultDocuments(user.uid)
        ]);
        setFolders(f);
        // ONLY allow selecting "Content" PDFs for CoWork! Past Papers shouldn't be read like textbooks here.
        setVaults(d.filter(doc => doc.type !== 'paper'));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const loadVault = async (vault: VaultDocument) => {
    setSelectedVault(vault);
    setLoading(true);
    try {
      const chunksRef = collection(db, `vaults/${vault.id}/chunks`);
      const q = query(chunksRef);
      const snapshot = await getDocs(q);
      
      const pageMap = new Map<number, string>();
      snapshot.forEach((doc) => {
        const data = doc.data();
        const pageNum = data.pageNumber || 0;
        if (pageMap.has(pageNum)) {
          pageMap.set(pageNum, pageMap.get(pageNum) + "\n\n" + data.text);
        } else {
          pageMap.set(pageNum, data.text);
        }
      });
      
      const loadedChunks: ChunkData[] = Array.from(pageMap.entries()).map(([pageNumber, text]) => ({
        pageNumber,
        text
      })).sort((a, b) => a.pageNumber - b.pageNumber);
      
      setChunks(loadedChunks);
      setCurrentIndex(0);
      setSummaries({});
      setAnalyzingStates({});
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeChunk = async (index: number) => {
    if (summaries[index] || analyzingStates[index] || chunks.length === 0) return;
    
    setAnalyzingStates(prev => ({ ...prev, [index]: true }));
    try {
      const response = await fetch("/api/cowork/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
           text: chunks[index].text,
           folderId: selectedVault?.folderId || null
        }),
      });
      if (!response.ok) throw new Error("Failed to analyze");
      const data = await response.json();
      setSummaries(prev => ({ ...prev, [index]: data }));
    } catch (error) {
      console.error(error);
      setSummaries(prev => ({ ...prev, [index]: { summary: "Failed to analyze this page.", highlightKeyword: "" } }));
    } finally {
      setAnalyzingStates(prev => ({ ...prev, [index]: false }));
    }
  };

  if (!user) return null;

  if (!selectedVault) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-20 p-6">
        <header className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => router.push('/dashboard')}
            className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="text-blue-400 w-8 h-8" /> CoWork Mode
            </h1>
            <p className="text-gray-400 mt-1">
              Select a Textbook or Notes document to read side-by-side with AI summarization.
            </p>
          </div>
        </header>

        <div className="bg-[#0f1629] border border-white/5 rounded-2xl p-6 shadow-xl">
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
          ) : vaults.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No Textbooks or Notes found. Please upload them in your Study Vault.</p>
          ) : (
            <div className="space-y-8">
              {folders.map(folder => {
                const folderDocs = vaults.filter(v => v.folderId === folder.id);
                if (folderDocs.length === 0) return null;
                
                return (
                  <div key={folder.id} className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider border-b border-white/5 pb-2">
                      📁 {folder.name}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {folderDocs.map((vault) => (
                        <div
                          key={vault.id}
                          onClick={() => loadVault(vault)}
                          className="p-4 rounded-xl cursor-pointer bg-white/[0.02] border border-white/10 hover:border-blue-500/50 hover:bg-blue-500/10 transition-all duration-200 group"
                        >
                          <div className="flex items-start gap-3">
                            <FileText className="w-5 h-5 text-emerald-400 mt-0.5 group-hover:scale-110 transition-transform" />
                            <div>
                              <h3 className="text-white font-medium line-clamp-1">{vault.fileName || "Untitled Vault"}</h3>
                              <p className="text-xs text-gray-400 mt-1">{vault.pageCount} pages • {vault.chunkCount} chunks</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              
              {/* Render uncategorized docs (just in case they have old docs from before folders) */}
              {vaults.filter(v => !v.folderId).length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider border-b border-white/5 pb-2">
                    📁 Uncategorized Documents
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {vaults.filter(v => !v.folderId).map((vault) => (
                      <div
                        key={vault.id}
                        onClick={() => loadVault(vault)}
                        className="p-4 rounded-xl cursor-pointer bg-white/[0.02] border border-white/10 hover:border-blue-500/50 hover:bg-blue-500/10 transition-all duration-200 group"
                      >
                        <div className="flex items-start gap-3">
                          <FileText className="w-5 h-5 text-emerald-400 mt-0.5 group-hover:scale-110 transition-transform" />
                          <div>
                            <h3 className="text-white font-medium line-clamp-1">{vault.fileName || "Untitled Vault"}</h3>
                            <p className="text-xs text-gray-400 mt-1">{vault.pageCount} pages • {vault.chunkCount} chunks</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  const activePageNumber = chunks[currentIndex]?.pageNumber || (currentIndex + 1);
  const activeKeyword = summaries[currentIndex]?.highlightKeyword || "";
  const pdfUrl = `/uploads/${selectedVault.id}.pdf#page=${activePageNumber}&navpanes=0&toolbar=0&scrollbar=0&view=FitH${activeKeyword ? `&search="${encodeURIComponent(activeKeyword)}"` : ''}`;

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col pb-6">
      <header className="flex items-center justify-between mb-6 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSelectedVault(null)}
            className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{selectedVault.title}</h1>
            <p className="text-sm text-gray-400">CoWork Continuous Flow</p>
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
        {/* Left Pane - Document PDF */}
        <div className="bg-black border border-white/5 rounded-2xl shadow-xl overflow-hidden flex flex-col relative transition-all duration-700">
          <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent z-10 pointer-events-none flex items-center gap-2 text-gray-300">
            <FileText className="w-4 h-4" />
            <span className="font-medium text-xs tracking-wide uppercase">Original PDF • Page {activePageNumber}</span>
          </div>
          <iframe 
            src={pdfUrl}
            className="w-full h-full border-0 bg-white"
            title="PDF Viewer"
          />
        </div>

        {/* Right Pane - Scrollable AI Insights List */}
        <div className="overflow-y-auto space-y-6 pr-2 pb-32 scroll-smooth">
          {chunks.map((chunk, index) => (
            <InsightCard 
              key={index}
              chunk={chunk}
              index={index}
              currentIndex={currentIndex}
              setCurrentIndex={setCurrentIndex}
              summaryData={summaries[index]}
              isAnalyzing={analyzingStates[index]}
              onAnalyze={analyzeChunk}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function InsightCard({ chunk, index, currentIndex, setCurrentIndex, summaryData, isAnalyzing, onAnalyze }: any) {
  const isActive = index === currentIndex;
  const isAnalyzed = !!summaryData;
  const cardRef = require("react").useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = require("react").useState<'summary' | 'practice' | 'pyqs'>('summary');
  
  require("react").useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        // Auto-analyze when it comes into view!
        if (!isAnalyzed && !isAnalyzing) {
          onAnalyze(index);
        }
      }
    }, { threshold: 0.2 });
    
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [index, isAnalyzed, isAnalyzing, onAnalyze]);

  const parseSections = (text: string) => {
    if (!text) return { summary: "", practice: "", pyqs: "" };
    const summaryMatch = text.match(/### 📝 Summary & Important Points([\s\S]*?)(?=### ❓ Practice Questions|$)/);
    const practiceMatch = text.match(/### ❓ Practice Questions([\s\S]*?)(?=### 📜 Previous Year Questions|$)/);
    const pyqMatch = text.match(/### 📜 Previous Year Questions \(PYQs\)([\s\S]*?)$/);
    
    return {
      summary: summaryMatch ? summaryMatch[1].trim() : text,
      practice: practiceMatch ? practiceMatch[1].trim() : "No practice questions found.",
      pyqs: pyqMatch ? pyqMatch[1].trim() : "No PYQs found."
    };
  };

  const sections = isAnalyzed ? parseSections(summaryData.summary) : { summary: "", practice: "", pyqs: "" };

  return (
    <div 
      ref={cardRef}
      onClick={() => setCurrentIndex(index)}
      className={`rounded-2xl border transition-all duration-500 cursor-pointer relative overflow-hidden flex flex-col ${
        isActive 
          ? 'bg-[#111827] border-blue-500/50 shadow-[0_0_40px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/20' 
          : 'bg-[#0f1629] border-white/5 opacity-60 hover:opacity-100'
      }`}
    >
      {isActive && (
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 animate-pulse" />
      )}
      
      <div className="p-6 pb-4 flex justify-between items-center border-b border-white/5 bg-black/20">
        <h3 className={`font-bold tracking-tight ${isActive ? 'text-blue-400 text-lg' : 'text-gray-400'}`}>
          Page {chunk.pageNumber}
        </h3>
        {!isActive && !isAnalyzed && !isAnalyzing && (
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Scroll to Analyze</span>
        )}
      </div>

      {isAnalyzed && (
        <div className="flex px-4 border-b border-white/5 bg-black/10">
          <button 
            onClick={(e) => { e.stopPropagation(); setActiveTab('summary'); }}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'summary' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-300'}`}
          >
            📝 Summary
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setActiveTab('practice'); }}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'practice' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-300'}`}
          >
            ❓ Practice
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setActiveTab('pyqs'); }}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'pyqs' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-400 hover:text-gray-300'}`}
          >
            📜 PYQs
          </button>
        </div>
      )}

      <div className="p-6">
        {isAnalyzing && (
          <div className="flex flex-col items-center justify-center py-8 text-blue-400 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm font-medium animate-pulse">Analyzing topics & PYQs...</p>
          </div>
        )}

        {isAnalyzed && (
          <div className={`prose prose-invert max-w-none transition-all duration-700 ${isActive ? 'opacity-100' : 'opacity-70'} prose-headings:text-blue-300 prose-a:text-blue-400 prose-strong:text-white whitespace-pre-wrap`}>
            {activeTab === 'summary' && <ReactMarkdown>{sections.summary}</ReactMarkdown>}
            {activeTab === 'practice' && <ReactMarkdown>{sections.practice}</ReactMarkdown>}
            {activeTab === 'pyqs' && <ReactMarkdown>{sections.pyqs}</ReactMarkdown>}
          </div>
        )}
      </div>
    </div>
  );
}
