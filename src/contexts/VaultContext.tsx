"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import type { VaultDocument } from "@/types";

interface VaultContextType {
  selectedVault: VaultDocument | null;
  setSelectedVault: (vault: VaultDocument | null) => void;
}

const VaultContext = createContext<VaultContextType>({
  selectedVault: null,
  setSelectedVault: () => {},
});

export function VaultProvider({ children }: { children: ReactNode }) {
  const [selectedVault, setSelectedVault] = useState<VaultDocument | null>(null);

  return (
    <VaultContext.Provider value={{ selectedVault, setSelectedVault }}>
      {children}
    </VaultContext.Provider>
  );
}

export function useVault() {
  return useContext(VaultContext);
}
