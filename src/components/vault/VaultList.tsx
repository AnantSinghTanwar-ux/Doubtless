"use client";



import { useVault } from "@/contexts/VaultContext";
import { deleteVaultFolder, deleteVaultDocument } from "@/lib/firestore";
import { formatDate } from "@/lib/utils";
import type { VaultFolder, VaultDocument } from "@/types";
import Badge from "@/components/ui/Badge";
import { Globe, Book, Folder, ChevronDown, ChevronRight, FileText, Upload, Trash2 } from "lucide-react";
import { useState } from "react";
import PdfUploader from "@/components/vault/PdfUploader";

interface VaultListProps {
  folders: VaultFolder[];
  documents: VaultDocument[];
  onRefresh: () => void;
}

export default function VaultList({ folders, documents, onRefresh }: VaultListProps) {
  const { selectedVault, setSelectedVault } = useVault();
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm("Delete this folder and all its contents?")) return;
    try {
      await deleteVaultFolder(folderId);
      // Hackathon: we are leaving orphaned documents in DB for now to save time,
      // but they won't render if folder is deleted.
      if (selectedVault?.folderId === folderId) setSelectedVault(null);
      onRefresh();
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => setSelectedVault(null)}
        className={`w-full p-4 rounded-xl border text-left transition-all duration-200 ${
          !selectedVault
            ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
            : "border-white/[0.06] bg-white/[0.02] text-gray-400 hover:bg-white/[0.04]"
        }`}
      >
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5" />
          <div>
            <p className="font-medium text-sm">General Knowledge Mode</p>
            <p className="text-xs opacity-60">No PDF context — uses AI knowledge</p>
          </div>
        </div>
      </button>

      {folders.map((folder) => {
        const folderDocs = documents.filter(d => d.folderId === folder.id);
        const isExpanded = expandedFolders[folder.id];
        
        return (
          <div key={folder.id} className="border border-white/10 bg-white/[0.02] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-black/20">
              <button 
                onClick={() => toggleFolder(folder.id)}
                className="flex items-center gap-3 flex-1 text-left"
              >
                {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                <Folder className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-semibold text-white">{folder.name}</h3>
                  <p className="text-xs text-gray-500">{folderDocs.length} files inside</p>
                </div>
              </button>
              <button 
                onClick={() => handleDeleteFolder(folder.id)}
                className="p-2 text-gray-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            
            {isExpanded && (
              <div className="p-4 border-t border-white/5 space-y-4 bg-black/10">
                {folderDocs.map(doc => (
                  <div
                    key={doc.id}
                    className={`p-3 rounded-xl border transition-all duration-200 flex justify-between items-center ${
                      selectedVault?.id === doc.id
                        ? "border-blue-500/30 bg-blue-500/10"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                    }`}
                  >
                    <button
                      onClick={() => setSelectedVault(doc)}
                      className="flex items-center gap-3 text-left flex-1"
                    >
                      {doc.type === 'paper' ? <FileText className="w-4 h-4 text-purple-400" /> : <Book className="w-4 h-4 text-emerald-400" />}
                      <div>
                        <p className="font-medium text-sm text-gray-200">{doc.fileName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={doc.type === 'paper' ? 'warning' : 'info'}>
                            {doc.type === 'paper' ? 'Past Paper' : 'Textbook/Notes'}
                          </Badge>
                          <span className="text-xs text-gray-500">{doc.pageCount} pages</span>
                        </div>
                      </div>
                    </button>
                  </div>
                ))}
                
                <div className="pt-4 border-t border-white/5 mt-4">
                  <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Add File to Folder
                  </h4>
                  <PdfUploader folderId={folder.id} onUploadComplete={onRefresh} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
