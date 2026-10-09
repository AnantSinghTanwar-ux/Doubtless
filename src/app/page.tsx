"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Loader from "@/components/ui/Loader";

export default function Home() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (!profile) {
      router.replace("/login");
    } else if (profile.role === "teacher") {
      router.replace("/teacher-dashboard");
    } else {
      router.replace("/dashboard");
    }
  }, [user, profile, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader size="lg" text="Loading Doubtless..." />
    </div>
  );
}
