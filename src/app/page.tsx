"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Loader from "@/components/ui/Loader";
import Landing from "@/components/landing/Landing";

export default function Home() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    // Signed in without a role yet (or an admin): the login page sorts that out.
    router.replace(!profile ? "/login" : profile.role === "teacher" ? "/teacher-dashboard" : "/dashboard");
  }, [user, profile, loading, router]);

  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader size="lg" text="Loading Doubtless..." />
      </div>
    );
  }

  return <Landing />;
}
