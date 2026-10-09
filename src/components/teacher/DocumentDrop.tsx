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
      <p className="text-sm font-medium text-slate-200 mb-1">{label}</p>
      <p className="text-xs text-slate-500 mb-3">{hint}</p>
      {value ? (
        <div className="flex items-center gap-4 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.05] p-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="w-20 h-14 rounded-lg object-cover border border-white/10" />
          ) : (
            <div className="w-20 h-14 rounded-lg bg-white/5 flex items-center justify-center">
              <FileText className="w-6 h-6 text-slate-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{value.name}</p>
            <p className="text-xs text-slate-500">{(value.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
          <button onClick={() => onChange(null)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5" aria-label="Remove file">
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
            dragging ? "border-blue-400 bg-blue-500/10" : "border-white/10 hover:border-white/20 hover:bg-[#fffdf8]/55"
          }`}
        >
          <UploadCloud className="w-7 h-7 mx-auto text-slate-500 mb-2" />
          <p className="text-sm text-slate-300">
            Drop a file or <span className="text-blue-400">browse</span>
          </p>
          <p className="text-xs text-slate-600 mt-1">JPG, PNG, WEBP or PDF · up to {MAX_MB} MB</p>
        </button>
      )}
      {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
      <input ref={input} type="file" accept={ACCEPT.join(",")} className="hidden" onChange={(e) => accept(e.target.files?.[0])} />
    </div>
  );
}
