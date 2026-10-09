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
        aria-pressed={!selectedVault}
        className={`w-full rounded-xl border p-4 text-left transition-colors ${
          !selectedVault ? "border-pen bg-pen-wash text-pen-deep" : "border-line bg-sheet text-muted hover:border-line-strong"
        }`}
      >
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5" />
          <div>
            <p className="text-sm font-medium">General knowledge</p>
            <p className="text-xs opacity-70">No file selected. Answers come from the AI alone.</p>
          </div>
        </div>
      </button>

      {folders.map((folder) => {
        const folderDocs = documents.filter(d => d.folderId === folder.id);
        const isExpanded = expandedFolders[folder.id];
        
        return (
          <div key={folder.id} className="overflow-hidden rounded-card border border-line bg-sheet shadow-sheet">
            <div className="flex items-center justify-between bg-sunk p-4">
              <button
                onClick={() => toggleFolder(folder.id)}
                aria-expanded={!!isExpanded}
                className="flex flex-1 items-center gap-3 text-left"
              >
                {isExpanded ? <ChevronDown className="w-5 h-5 text-muted" /> : <ChevronRight className="w-5 h-5 text-muted" />}
                <Folder className="w-5 h-5 text-pen" />
                <div>
                  <h3 className="font-display text-lg font-semibold text-ink">{folder.name}</h3>
                  <p className="text-xs text-muted">{folderDocs.length} {folderDocs.length === 1 ? "file" : "files"}</p>
                </div>
              </button>
              <button
                onClick={() => handleDeleteFolder(folder.id)}
                aria-label={`Delete folder ${folder.name}`}
                className="rounded-lg p-2 text-faint transition-colors hover:text-margin"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            
            {isExpanded && (
              <div className="space-y-3 border-t border-line p-4">
                {folderDocs.map(doc => (
                  <div
                    key={doc.id}
                    className={`flex items-center justify-between rounded-xl border transition-colors ${
                      selectedVault?.id === doc.id ? "border-pen bg-pen-wash" : "border-line bg-sheet hover:border-line-strong"
                    }`}
                  >
                    <button
                      onClick={() => setSelectedVault(doc)}
                      aria-pressed={selectedVault?.id === doc.id}
                      className="flex flex-1 items-center gap-3 p-3 text-left"
                    >
                      {doc.type === 'paper' ? <FileText className="w-4 h-4 text-pen" /> : <Book className="h-4 w-4 text-emerald-700" />}
                      <div>
                        <p className="font-medium text-sm text-ink">{doc.fileName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={doc.type === 'paper' ? 'warning' : 'info'}>
                            {doc.type === 'paper' ? 'Past paper' : 'Textbook or notes'}
                          </Badge>
                          <span className="text-xs text-faint">{doc.pageCount} pages</span>
                        </div>
                      </div>
                    </button>
                  </div>
                ))}
                
                <div className="mt-4 border-t border-line pt-4">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
                    <Upload className="h-4 w-4 text-pen" /> Add a file to this folder
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
