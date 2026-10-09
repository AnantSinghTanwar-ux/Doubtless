export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function generateJitsiRoom(sessionId: string): string {
  return `doubtless-session-${sessionId}-${Date.now()}`;
}

export function getRouteColor(route: string): string {
  switch (route) {
    case "ai_explain":
      return "text-blue-400";
    case "practice":
      return "text-emerald-400";
    case "teacher":
      return "text-amber-400";
    default:
      return "text-gray-400";
  }
}

export function getRouteIcon(route: string): string {
  switch (route) {
    case "ai_explain":
      return "🤖";
    case "practice":
      return "📝";
    case "teacher":
      return "👨‍🏫";
    default:
      return "❓";
  }
}

export function getVerdictColor(verdict: string): string {
  switch (verdict) {
    case "correct":
      return "text-emerald-400 bg-emerald-400/10 border-emerald-400/30";
    case "error":
      return "text-red-400 bg-red-400/10 border-red-400/30";
    case "redundant":
      return "text-amber-400 bg-amber-400/10 border-amber-400/30";
    case "unclear":
      return "text-gray-400 bg-gray-400/10 border-gray-400/30";
    default:
      return "text-gray-400";
  }
}

export function getScoreColor(score: number): string {
  if (score >= 8) return "text-emerald-400";
  if (score >= 6) return "text-yellow-400";
  if (score >= 4) return "text-amber-400";
  return "text-red-400";
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
