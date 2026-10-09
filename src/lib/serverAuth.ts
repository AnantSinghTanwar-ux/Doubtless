import { NextRequest } from "next/server";

export interface VerifiedUser {
  uid: string;
  email: string;
  name: string;
}

export class AuthError extends Error {
  constructor(message: string, public status: 401 | 403 = 401) {
    super(message);
  }
}

/**
 * Verifies the Firebase ID token sent as `Authorization: Bearer <token>`.
 * Uses the Identity Toolkit REST API so no service-account credentials are needed.
 */
export async function requireUser(request: NextRequest, tokenOverride?: string | null): Promise<VerifiedUser> {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : tokenOverride || "";
  if (!token) throw new AuthError("Sign in to continue.");

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token }),
    cache: "no-store",
  });
  if (!res.ok) throw new AuthError("Your session has expired. Please sign in again.");
  const data = await res.json();
  const user = data.users?.[0];
  if (!user?.localId) throw new AuthError("Your session has expired. Please sign in again.");
  return { uid: user.localId, email: (user.email || "").toLowerCase(), name: user.displayName || "" };
}

export function isAdminEmail(email: string): boolean {
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return !!email && admins.includes(email.toLowerCase());
}

export async function requireAdmin(request: NextRequest): Promise<VerifiedUser> {
  const user = await requireUser(request);
  if (!isAdminEmail(user.email)) throw new AuthError("Admins only.", 403);
  return user;
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
  return null;
}
