"use client";

import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { useSocialContext } from "@/contexts/SocialContext";

interface AppShellProps {
  children: React.ReactNode;
  sidebar?: boolean;
}

export function AppShell({ children, sidebar = true }: AppShellProps) {
  return (
    <div className="flex min-h-dvh bg-bg-base">
      {sidebar && <Sidebar />}
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden pb-16 lg:pb-0">{children}</main>
      {sidebar && <MobileNav />}
      <ChallengeOverlay />
    </div>
  );
}

function ChallengeOverlay() {
  const { pendingChallenges, acceptChallenge, declineChallenge } = useSocialContext();

  if (pendingChallenges.length === 0) return null;

  return (
    <div
      className="fixed z-[1000] flex flex-col gap-3 bottom-20 left-4 right-4 sm:bottom-6 sm:left-auto sm:right-6"
    >
      {pendingChallenges.map((c) => (
        <div
          key={c.challengeId}
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-gold-primary)",
            borderRadius: 12,
            padding: "16px 20px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            animation: "slideUp 0.3s ease",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              color: "var(--color-gold-primary)",
              marginBottom: 8,
              fontFamily: "var(--font-body)",
            }}
          >
            Challenge!
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--color-text-primary)",
              marginBottom: 14,
              fontFamily: "var(--font-body)",
            }}
          >
            {c.fromName || c.fromAddress.slice(0, 12) + "..."} wants to play
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => acceptChallenge(c.challengeId)}
              style={{
                flex: 1,
                padding: "8px 16px",
                borderRadius: 6,
                border: "none",
                background: "var(--color-gold-primary)",
                color: "var(--color-accent-fg)",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              Accept
            </button>
            <button
              onClick={() => declineChallenge(c.challengeId)}
              style={{
                flex: 1,
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid var(--color-bg-subtle)",
                background: "transparent",
                color: "var(--color-text-secondary)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              Decline
            </button>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
