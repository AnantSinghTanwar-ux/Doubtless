import { cn } from "@/lib/utils";

export default function Logo({ className, size = 44 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn("relative flex items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-[#fff1e6] to-[#fbf8f0] font-display font-bold text-violet-300 shadow-[0_0_24px_-6px_rgba(194, 65, 12,0.6)]", className)}
      style={{ width: size, height: size, fontSize: size * 0.48 }}
    >
      S
    </span>
  );
}
