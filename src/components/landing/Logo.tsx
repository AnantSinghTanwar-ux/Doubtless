import { cn } from "@/lib/utils";

export default function Logo({ className, size = 44 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn("relative flex items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-[#1b1530] to-[#0c0c10] font-display font-bold text-violet-300 shadow-[0_0_24px_-6px_rgba(139,92,246,0.6)]", className)}
      style={{ width: size, height: size, fontSize: size * 0.48 }}
    >
      D
    </span>
  );
}
