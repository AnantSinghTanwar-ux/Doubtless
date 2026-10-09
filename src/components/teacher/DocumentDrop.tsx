"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, UploadCloud, X } from "lucide-react";

const ACCEPT = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_MB = 8;

export default function DocumentDrop({ label, hint, value, onChange }: { label: string; hint: string; value: File | null; onChange: (f: File | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const preview = useMemo(() => (value?.type.startsWith("image/") ? URL.createObjectURL(value) : null), [value]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const accept = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) return setError("Upload a JPG, PNG, WEBP or PDF.");
    if (file.size > MAX_MB * 1024 * 1024) return setError(`File must be under ${MAX_MB} MB.`);
    setError("");
    onChange(file);
  };

  return (
    <div>
      <p className="text-sm font-medium text-ink mb-1">{label}</p>
      <p className="text-xs text-faint mb-3">{hint}</p>
      {value ? (
        <div className="flex items-center gap-4 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.05] p-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="w-20 h-14 rounded-lg object-cover border border-line" />
          ) : (
            <div className="w-20 h-14 rounded-lg bg-ink/5 flex items-center justify-center">
              <FileText className="w-6 h-6 text-muted" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-ink truncate">{value.name}</p>
            <p className="text-xs text-faint">{(value.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
          <button onClick={() => onChange(null)} className="p-2 rounded-lg text-muted hover:text-ink hover:bg-ink/5" aria-label="Remove file">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            accept(e.dataTransfer.files[0]);
          }}
          className={`w-full rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
            dragging ? "border-pen bg-pen/10" : "border-line hover:border-line-strong hover:bg-sheet"
          }`}
        >
          <UploadCloud className="w-7 h-7 mx-auto text-faint mb-2" />
          <p className="text-sm text-ink/80">
            Drop a file or <span className="text-pen">browse</span>
          </p>
          <p className="text-xs text-faint mt-1">JPG, PNG, WEBP or PDF · up to {MAX_MB} MB</p>
        </button>
      )}
      {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
      <input ref={input} type="file" accept={ACCEPT.join(",")} className="hidden" onChange={(e) => accept(e.target.files?.[0])} />
    </div>
  );
}
