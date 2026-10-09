"use client";

import { auth } from "./firebase";

/** fetch() that attaches the signed-in user's Firebase ID token and surfaces API error messages. */
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

export async function authedJSON<T>(input: string, init: RequestInit = {}): Promise<T> {
  const res = await authedFetch(input, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}
