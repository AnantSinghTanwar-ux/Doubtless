"use client";

import { useAuth } from "@/contexts/AuthContext";
import Loader from "@/components/ui/Loader";
import Landing from "@/components/landing/Landing";

export default function Home() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader size="lg" text="Loading ωlvε..." />
      </div>
    );
  }

  return <Landing />;
}
