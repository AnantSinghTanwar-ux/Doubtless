"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

interface DoubtInputProps {
  onSubmit: (question: string) => void;
  loading: boolean;
}

export default function DoubtInput({ onSubmit, loading }: DoubtInputProps) {
  const [question, setQuestion] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;
    onSubmit(question.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        aria-label="Your doubt"
        placeholder="Describe what you're stuck on. For example: I don't understand how backpropagation calculates gradients."
        className="min-h-[140px] w-full resize-none rounded-card p-4 pb-16 shadow-sheet"
        disabled={loading}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
      />
      <div className="absolute bottom-3 left-4 right-3 flex items-center justify-between gap-3">
        <span className="hidden text-xs text-faint sm:block">Enter to send, Shift+Enter for a new line</span>
        <Button type="submit" disabled={!question.trim() || loading} loading={loading} size="sm" className="ml-auto">
          Ask
        </Button>
      </div>
    </form>
  );
}
