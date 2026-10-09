"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { authedJSON } from "@/lib/apiClient";

/* One check per signed-in user, shared by every component that asks (sidebar, bottom nav...), instead of one per component per page. */
const checks = new Map<string, Promise<boolean>>();
const answers = new Map<string, boolean>();

function check(uid: string): Promise<boolean> {
  let p = checks.get(uid);
  if (!p) {
    p = authedJSON<{ isAdmin: boolean }>("/api/admin/me")
      .then((r) => (answers.set(uid, r.isAdmin), r.isAdmin))
      .catch(() => (checks.delete(uid), false)); // retry on the next mount if it failed
    checks.set(uid, p);
  }
  return p;
}

/** Whether the signed-in user is listed in ADMIN_EMAILS (checked server-side). */
export function useIsAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(() => (user ? answers.get(user.uid) ?? false : false));

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void check(user.uid).then((v) => alive && setIsAdmin(v));
    return () => {
      alive = false;
    };
  }, [user]);

  return !!user && isAdmin;
}
