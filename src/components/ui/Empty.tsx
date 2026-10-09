"use client";

export default function Empty({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-line-strong px-4 py-14 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-pen/10 text-pen [&_svg]:h-6 [&_svg]:w-6">{icon}</span>
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      <p className="mb-6 mt-1.5 max-w-sm text-sm text-muted">{description}</p>
      {action}
    </div>
  );
}
