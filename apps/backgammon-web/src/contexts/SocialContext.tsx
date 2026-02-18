"use client";

import { createContext, useContext } from "react";
import { useSocial } from "@/hooks/useSocial";
import { useAuth } from "@/hooks/useAuth";
import { WS_URL } from "@/lib/ws-config";

type SocialContextValue = ReturnType<typeof useSocial>;

const SocialContext = createContext<SocialContextValue | null>(null);

export function SocialProvider({ children }: { children: React.ReactNode }) {
  const { address } = useAuth();
  const social = useSocial(WS_URL, address);

  return (
    <SocialContext.Provider value={social}>{children}</SocialContext.Provider>
  );
}

export function useSocialContext(): SocialContextValue {
  const ctx = useContext(SocialContext);
  if (!ctx) {
    throw new Error("useSocialContext must be used within a SocialProvider");
  }
  return ctx;
}
