"use client";

import { FileUp } from "lucide-react";
import { useState, useRef } from "react";
import Button from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { authedJSON } from "@/lib/apiClient";
import { chunkCount, uploadMedia } from "@/lib/mediaStore";
import { MAX_UPLOAD_MB, docKind, extractDocumentPages } from "@/lib/documentText";

interface PdfUploaderProps {
  folderId?: string;
  onUploadComplete: () => void;
}

export default function PdfUploader({ folderId, onUploadComplete }: PdfUploaderProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [docType, setDocType] = useState<"content" | "paper">("content");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (!user || !file) return;
    const kind = docKind(file);
    if (!kind) {
      setProgress(file.name.toLowerCase().endsWith(".ppt") ? "Old .ppt files aren't supported. Save it as .pptx or PDF and try again." : "Please upload a PDF or PowerPoint (.pptx) file.");
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setProgress(`That file is larger than ${MAX_UPLOAD_MB} MB.`);
      return;
    }

    setUploading(true);
    try {
      // 1. Read the text here in the browser: big files never have to pass through the server.
      setProgress(kind === "pptx" ? "Reading slides…" : "Reading pages…");
      const { pages, pageCount } = await extractDocumentPages(file, kind);

      // 2. Send only the text to be chunked, embedded and indexed.
      setProgress("Indexing for search…");
      const result = await authedJSON<{ vaultId: string; chunkCount: number; pageCount: number }>("/api/vault/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, pageCount, pages, folderId, type: docType }),
      });

      // 3. Keep the original so CoWork can display it (PDFs only: PowerPoints can't be rendered in the browser).
      if (kind === "pdf") {
        const parts = chunkCount(file.size);
        let saved = 0;
        setProgress("Saving your file… 0%");
        await uploadMedia(user.uid, `pdf-${result.vaultId}`, file, () => setProgress(`Saving your file… ${Math.round((++saved / parts) * 100)}%`)).catch((e) =>
          console.error("Could not store the PDF for CoWork:", e)
        );
      }

      setProgress(`✓ Added ${file.name}: ${pageCount} ${kind === "pptx" ? "slides" : "pages"} read and indexed${kind === "pptx" ? ". (CoWork reading mode needs a PDF.)" : ""}`);
      onUploadComplete();
    } catch (error) {
      setProgress(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Upload a PDF or PowerPoint"
        className={`cursor-pointer rounded-card border-2 border-dashed p-10 text-center transition-colors ${
          dragOver ? "border-pen bg-pen-wash" : "border-line-strong hover:border-pen hover:bg-pen-wash"
        }`}
      >
        <FileUp className="mx-auto mb-3 h-8 w-8 text-pen" aria-hidden />
        <p className="mb-1 font-medium text-ink">
          {uploading ? "Processing..." : "Drop a PDF or PowerPoint here, or click to browse"}
        </p>
        <p className="text-sm text-muted">
          {docType === 'content' ? "Notes, textbooks, study material" : "Past papers, exam questions"}
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.pptx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
      </div>

      {folderId && !uploading && (
        <div className="flex justify-center gap-4 pt-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-ink/80 hover:text-ink">
            <input 
              type="radio" 
              name={`type-${folderId}`} 
              checked={docType === 'content'} 
              onChange={() => setDocType('content')} 
              className="accent-pen"
            />
            Textbook or notes
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-ink/80 hover:text-ink">
            <input 
              type="radio" 
              name={`type-${folderId}`} 
              checked={docType === 'paper'} 
              onChange={() => setDocType('paper')} 
              className="accent-pen"
            />
            Past paper
          </label>
        </div>
      )}

      {uploading && (
        <div className="space-y-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-label="Uploading">
            <div className="h-full bg-pen rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      )}

      {progress && (
        <p className={`text-sm ${progress.startsWith("✓") ? "text-emerald-700" : progress.startsWith("Please") ? "text-margin" : "text-muted"}`}>
          {progress}
        </p>
      )}
    </div>
  );
}
