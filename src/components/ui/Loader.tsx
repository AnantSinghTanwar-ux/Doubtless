"use client";

export default function Loader({ size = "md", text }: { size?: "sm" | "md" | "lg"; text?: string }) {
  const sizes = {
    sm: "h-5 w-5",
    md: "h-8 w-8",
    lg: "h-11 w-11",
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12" role="status" aria-live="polite">
      <div className={`${sizes[size]} relative`}>
        <div className="absolute inset-0 rounded-full border-2 border-ink/10" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-pen" />
      </div>
      {text ? <p className="max-w-xs text-center text-sm text-muted">{text}</p> : <span className="sr-only">Loading</span>}
    </div>
  );
}
