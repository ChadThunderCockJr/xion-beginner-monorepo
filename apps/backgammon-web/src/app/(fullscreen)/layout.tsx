"use client";

import { SocialProvider } from "@/contexts/SocialContext";

export default function FullscreenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SocialProvider>
      <div className="min-h-dvh bg-bg-deepest">{children}</div>
    </SocialProvider>
  );
}
