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
        placeholder="What's your doubt? e.g., I don't understand how backpropagation calculates gradients..."
        className="w-full min-h-[120px] p-4 pr-16 bg-[#fffdf8]/75 border border-white/[0.06] rounded-2xl text-white placeholder-gray-500 resize-none focus:ring-2 focus:ring-blue-500/50 transition-all"
        disabled={loading}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
      />
      <div className="absolute bottom-4 right-4">
        <Button
          type="submit"
          disabled={!question.trim() || loading}
          loading={loading}
          size="sm"
          className="rounded-xl px-4 py-2"
        >
          Ask
        </Button>
      </div>
    </form>
  );
}
