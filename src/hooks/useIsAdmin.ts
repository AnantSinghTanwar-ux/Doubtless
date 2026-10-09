"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { authedJSON } from "@/lib/apiClient";

/** Whether the signed-in user is listed in ADMIN_EMAILS (checked server-side). */
export function useIsAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    authedJSON<{ isAdmin: boolean }>("/api/admin/me")
      .then((r) => alive && setIsAdmin(r.isAdmin))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user]);

  return !!user && isAdmin;
}
