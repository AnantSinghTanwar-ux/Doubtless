"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeToMessages, sendMessage } from "@/lib/firestore";
import type { SessionMessage } from "@/types";
import { formatTime } from "@/lib/utils";

interface SessionChatProps {
  sessionId: string;
}

export default function SessionChat({ sessionId }: SessionChatProps) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeToMessages(sessionId, (msgs) => {
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user || !profile) return;

    try {
      await sendMessage(sessionId, {
        senderId: user.uid,
        senderName: profile.displayName.split(" ")[0],
        text: input.trim(),
        timestamp: Date.now(),
      });
      setInput("");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent border border-line rounded-card overflow-hidden relative">
      <div className="p-4 border-b border-line bg-sheet">
        <h3 className="font-semibold text-ink flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Live Chat
        </h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <p className="text-center text-faint text-sm mt-10">No messages yet. Say hi!</p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user?.uid;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-faint mb-1 px-1">
                  {msg.senderName} · {formatTime(msg.timestamp)}
                </span>
                <div className={`max-w-[80%] rounded-card px-4 py-2 text-sm ${
                  isMe 
                    ? 'bg-pen text-snow rounded-tr-sm' 
                    : 'bg-ink/[0.05] text-ink border border-line rounded-tl-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="p-3 bg-sheet border-t border-line flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-sheet border-line text-sm"
        />
        <button 
          type="submit"
          disabled={!input.trim()}
          className="w-10 h-10 flex-none rounded-xl bg-pen flex items-center justify-center text-snow disabled:opacity-50 disabled:bg-ink/10"
        >
          <svg className="w-4 h-4 transform rotate-90" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
