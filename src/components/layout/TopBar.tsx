"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useVault } from "@/contexts/VaultContext";

export default function TopBar({ title }: { title: string }) {
  const { profile } = useAuth();
  const { selectedVault } = useVault();

  return (
    <header className="sticky top-0 z-30 bg-[#0a0f1e]/80 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="lg:hidden w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
            D
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{title}</h1>
            {selectedVault && (
              <p className="text-xs text-blue-400 mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                {selectedVault.fileName}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {profile?.photoURL ? (
            <img
              src={profile.photoURL}
              alt=""
              className="w-8 h-8 rounded-full border-2 border-white/10 lg:hidden"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold lg:hidden">
              {profile?.displayName?.charAt(0) ?? "?"}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
