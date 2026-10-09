import { cn } from "@/lib/utils";

/** Ink tile with a cream S and a short red-pen underline. */
export default function Logo({ className, size = 44 }: { className?: string; size?: number }) {
  return (
    <span
      aria-hidden
      className={cn("relative flex shrink-0 items-center justify-center rounded-[28%] bg-ink font-display font-semibold text-snow", className)}
      style={{ width: size, height: size, fontSize: size * 0.54 }}
    >
      S
      <span className="absolute bottom-[18%] left-1/2 h-[7%] w-[34%] -translate-x-1/2 -rotate-6 rounded-full bg-pen" />
    </span>
  );
}
