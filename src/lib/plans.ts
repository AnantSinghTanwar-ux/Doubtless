/**
 * Which features each plan includes (plans and prices: /business). Payments aren't live yet, so nothing is gated:
 * set NEXT_PUBLIC_ENFORCE_PLANS=true once they are, and store the user's plan on their profile.
 */
export type Feature = "voiceAgent";

const PLAN_FEATURES: Record<string, Feature[]> = {
  free: [],
  pro: ["voiceAgent"],
  sprint: ["voiceAgent"],
};

const ENFORCED = process.env.NEXT_PUBLIC_ENFORCE_PLANS === "true";

export function hasFeature(plan: string | undefined, feature: Feature): boolean {
  return !ENFORCED || (PLAN_FEATURES[plan ?? "free"] ?? []).includes(feature);
}
