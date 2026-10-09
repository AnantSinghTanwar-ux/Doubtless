import { AlertTriangle, CheckCircle2, Info, Lightbulb, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  success: { box: "border-emerald-700/25 bg-emerald-600/[0.07]", icon: "text-emerald-700", Icon: CheckCircle2 },
  error: { box: "border-margin/30 bg-margin/[0.07]", icon: "text-margin", Icon: AlertTriangle },
  warning: { box: "border-amber-700/25 bg-amber-500/10", icon: "text-amber-800", Icon: Lightbulb },
  info: { box: "border-pen/25 bg-pen-wash", icon: "text-pen", Icon: Info },
};

/** A short message with an icon: used for results, hints and notices. */
export default function Callout({
  tone = "info",
  title,
  children,
  icon,
  className,
}: {
  tone?: keyof typeof tones;
  title: string;
  children?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  const t = tones[tone];
  const Icon = icon ?? t.Icon;
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border p-4", t.box, className)} role={tone === "error" ? "alert" : undefined}>
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", t.icon)} aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{title}</p>
        {children && <div className="mt-1 text-sm text-muted">{children}</div>}
      </div>
    </div>
  );
}
