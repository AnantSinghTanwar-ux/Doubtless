"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useVault } from "@/contexts/VaultContext";
import Logo from "@/components/landing/Logo";

const clamp = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Page header. At the top of the page it sits flat; as you scroll it lifts off the edges into a floating,
 * rounded, blurred bar and the title tightens up.
 */
export default function TopBar({ title }: { title: string }) {
  const { profile } = useAuth();
  const { selectedVault } = useVault();
  const [p, setP] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    const update = () => {
      frame.current = 0;
      setP(clamp(window.scrollY / 90));
    };
    const onScroll = () => {
      if (!frame.current) frame.current = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame.current);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30" style={{ paddingInline: p * 16, paddingTop: p * 10, transition: "padding 160ms ease-out" }}>
      <div
        style={{
          paddingInline: 24 - p * 6,
          paddingBlock: 16 - p * 6,
          borderRadius: p * 22,
          background: `rgba(12, 12, 16, ${0.6 + p * 0.2})`,
          border: `1px solid rgba(255, 255, 255, ${0.06 + p * 0.06})`,
          borderTopColor: "transparent",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          boxShadow: `0 14px 40px -16px rgba(139, 92, 246, ${p * 0.45})`,
          transition: "all 160ms ease-out",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="lg:hidden">
              <Logo size={34} />
            </span>
            <div>
              <h1 key={title} className="slide-up font-display font-bold text-white" style={{ fontSize: 24 - p * 3 }}>
                {title}
              </h1>
              {selectedVault && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-violet-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
                  {selectedVault.fileName}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {profile?.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.photoURL} alt="" className="h-9 w-9 rounded-full border-2 border-white/10 object-cover lg:hidden" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-700 text-xs font-bold text-white lg:hidden">
                {profile?.displayName?.charAt(0) ?? "?"}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
