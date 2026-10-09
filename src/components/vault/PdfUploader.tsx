"use client";

import { useState, useRef } from "react";
import Button from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";

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
    if (file.type !== "application/pdf") {
      setProgress("Please upload a PDF file");
      return;
    }

    setUploading(true);
    setProgress("Extracting text from PDF...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", user.uid);
      if (folderId) formData.append("folderId", folderId);
      formData.append("type", docType);

      setProgress("Processing and embedding chunks...");

      const response = await fetch("/api/vault/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Upload failed");
      }

      const result = await response.json();
      
      if (result.jobId) {
        setProgress("Job queued. Processing PDF in background...");
        
        const poll = async () => {
          try {
            const res = await fetch(`/api/jobs/${result.jobId}`);
            const data = await res.json();
            
            if (data.ok) {
               if (data.job.status === "completed") {
                 setProgress(`✓ Background processing finished!`);
                 onUploadComplete();
                 setUploading(false);
               } else if (data.job.status === "failed") {
                 setProgress(`Failed: ${data.job.error}`);
                 setUploading(false);
               } else {
                 setTimeout(poll, 2000);
               }
            } else {
               setProgress("Failed to check job status.");
               setUploading(false);
            }
          } catch(e) {
            setProgress("Failed to check job status.");
            setUploading(false);
          }
        };
        
        setTimeout(poll, 2000);
        return;
      }

      setProgress(`✓ Uploaded: ${result.chunkCount} chunks from ${result.pageCount} pages`);
      onUploadComplete();
      setUploading(false);
    } catch (error) {
      setProgress(error instanceof Error ? error.message : "Upload failed");
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
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ${
          dragOver
            ? "border-blue-500 bg-blue-500/10"
            : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
        }`}
      >
        <div className="text-4xl mb-3">📄</div>
        <p className="text-white font-medium mb-1">
          {uploading ? "Processing..." : "Drop a PDF here or click to browse"}
        </p>
        <p className="text-sm text-gray-500">
          {docType === 'content' ? "Notes, textbooks, study material" : "Past papers, exam questions"}
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
      </div>

      {folderId && !uploading && (
        <div className="flex justify-center gap-4 pt-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300 hover:text-white">
            <input 
              type="radio" 
              name={`type-${folderId}`} 
              checked={docType === 'content'} 
              onChange={() => setDocType('content')} 
              className="accent-blue-500"
            />
            Textbook / Notes
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300 hover:text-white">
            <input 
              type="radio" 
              name={`type-${folderId}`} 
              checked={docType === 'paper'} 
              onChange={() => setDocType('paper')} 
              className="accent-purple-500"
            />
            Past Paper / PYQ
          </label>
        </div>
      )}

      {uploading && (
        <div className="space-y-2">
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      )}

      {progress && (
        <p className={`text-sm ${progress.startsWith("✓") ? "text-emerald-400" : progress.startsWith("Please") ? "text-red-400" : "text-gray-400"}`}>
          {progress}
        </p>
      )}
    </div>
  );
}
