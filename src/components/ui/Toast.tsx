"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

interface ToastProps {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
}

const styles = {
  success: { box: "border-emerald-700/30", icon: CheckCircle2, color: "text-emerald-700" },
  error: { box: "border-margin/40", icon: AlertCircle, color: "text-margin" },
  info: { box: "border-pen/30", icon: Info, color: "text-pen" },
};

export default function Toast({ message, type, onClose }: ToastProps) {
  const { box, icon: Icon, color } = styles[type];

  return (
    <div role="status" className={`slide-up flex max-w-sm items-start gap-3 rounded-xl border bg-sheet px-4 py-3 shadow-lift ${box}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} aria-hidden />
      <p className="text-sm font-medium text-ink">{message}</p>
      <button onClick={onClose} aria-label="Dismiss" className="ml-auto rounded p-0.5 text-faint transition-colors hover:text-ink">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
