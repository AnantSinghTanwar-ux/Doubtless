"use client";

import { useEffect, useRef, ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export default function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="fade-in absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "animate-in relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-sheet shadow-lift outline-none sm:rounded-2xl",
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between p-6 pb-0">
            <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
            <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-faint transition-colors hover:bg-ink/[0.06] hover:text-ink">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
