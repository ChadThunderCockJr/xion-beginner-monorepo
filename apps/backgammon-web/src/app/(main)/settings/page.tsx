"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, SectionLabel, SegmentToggle } from "@/components/ui";
import { useSocialContext } from "@/contexts/SocialContext";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";

// ─── Constants ─────────────────────────────────────────────────────
const BOARD_THEMES = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "lux", label: "Lux" },
];

const NOTATION_STYLES = [
  { id: "international", label: "International" },
  { id: "american", label: "American" },
];

// ─── Icons ─────────────────────────────────────────────────────────
function ShieldIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="var(--color-text-secondary)" strokeWidth="1.5">
      <path d="M8 1.5L3 4v3c0 3 2 5.5 5 6.5 3-1 5-3.5 5-6.5V4L8 1.5z" />
      <path d="M6 8l1.5 1.5L10.5 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5">
      <rect x="2" y="5" width="16" height="11" rx="2" />
      <path d="M14 10.5a1 1 0 100 2 1 1 0 000-2z" fill="var(--color-text-muted)" />
      <path d="M2 8h16" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--color-success)" strokeWidth="2">
      <path d="M3 8.5l3.5 3.5L13 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="5" y="5" width="8" height="8" rx="1.5" />
      <path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" strokeLinecap="round" />
    </svg>
  );
}

// ─── Toggle Switch ─────────────────────────────────────────────────
function ToggleSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div onClick={onToggle} style={{
      width: 40, height: 22, borderRadius: 11, cursor: "pointer",
      background: on ? "var(--color-gold-primary)" : "var(--color-bg-subtle)",
      position: "relative", transition: "background 0.15s ease", flexShrink: 0,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: "50%",
        background: "var(--color-text-primary)", position: "absolute", top: 2,
        left: on ? 20 : 2, transition: "left 0.15s ease",
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
      }} />
    </div>
  );
}

// ─── Transaction Row ───────────────────────────────────────────────
function TransactionRow({ type, amount, status, date }: { type: string; amount: string; status: string; date: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 0", borderBottom: "1px solid var(--color-bg-subtle)",
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6,
        background: "var(--color-bg-base)", border: "1px solid var(--color-bg-subtle)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, color: "var(--color-text-secondary)",
      }}>
        {type === "Deposit" ? "\u2193" : type === "Withdrawal" ? "\u2191" : amount.startsWith("+") ? "+" : "\u2212"}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)" }}>{type}</div>
        <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{date}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)",
          fontFamily: "var(--font-mono)",
        }}>{amount}</div>
        <div style={{
          fontSize: 9, color: "var(--color-text-muted)", textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}>{status}</div>
      </div>
    </div>
  );
}

// ─── Mock data (will be replaced when wallet integration is done) ──
const TRANSACTIONS = [
  { type: "Deposit", amount: "+$50.00", status: "Confirmed", date: "3 days ago" },
  { type: "Wager Lost", amount: "\u2212$12.50", status: "Settled", date: "2 days ago" },
  { type: "Wager Won", amount: "+$8.75", status: "Settled", date: "1 day ago" },
  { type: "Deposit", amount: "+$100.00", status: "Confirmed", date: "1 week ago" },
  { type: "Withdrawal", amount: "\u2212$25.00", status: "Confirmed", date: "2 weeks ago" },
];

// ═══════════════════════════════════════════════════════════════════
// MAIN — SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════════
export default function SettingsPage() {
  const { address, logout } = useAuth();
  const social = useSocialContext();

  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState("");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notationStyle, setNotationStyle] = useState("international");
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [notifications, setNotifications] = useState({
    matchInvites: true,
    friendRequests: true,
    tournamentAlerts: false,
  });

  const walletBalance = 124.50;

  // Sync display name from social context
  useEffect(() => {
    if (social.displayName) {
      setDisplayName(social.displayName);
    }
  }, [social.displayName]);

  const handleSaveDisplayName = useCallback(() => {
    const trimmed = displayName.trim();
    if (trimmed && trimmed !== social.displayName) {
      social.setDisplayName(trimmed);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }, [displayName, social]);

  const handleCopyAddress = useCallback(() => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [address]);

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      fontFamily: "var(--font-body)",
      color: "var(--color-text-primary)",
    }}>
      <main className="p-4 md:p-6 lg:px-6 lg:py-7" style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", overflow: "auto",
      }}>
        <div style={{ width: "100%", maxWidth: 640 }}>

          {/* Page Header */}
          <header style={{ marginBottom: 28 }}>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 30,
                fontWeight: 700,
                color: "var(--color-text-primary)",
                margin: 0,
              }}
            >
              Settings
            </h1>
            <p
              style={{
                fontSize: 14,
                color: "var(--color-text-muted)",
                margin: "4px 0 0",
                fontFamily: "var(--font-body)",
              }}
            >
              Manage your account and preferences
            </p>
          </header>

          {/* ═══ ACCOUNT ══════════════════════════════════════ */}
          <Card style={{ marginBottom: 16 }}>
            <SectionLabel>Account</SectionLabel>

            {/* Address */}
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)",
                textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6,
              }}>Wallet Address</div>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 14px", borderRadius: 6,
                border: "1.5px solid var(--color-bg-subtle)", background: "var(--color-bg-base)",
              }}>
                <span style={{
                  flex: 1, fontSize: 13, color: "var(--color-text-secondary)",
                  fontFamily: "var(--font-mono)", overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {address || "Not connected"}
                </span>
                <button
                  onClick={handleCopyAddress}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: copied ? "var(--color-success)" : "var(--color-text-muted)",
                    display: "flex", alignItems: "center", gap: 4,
                    fontSize: 11, fontWeight: 600, fontFamily: "var(--font-body)",
                    padding: "2px 6px", borderRadius: 4,
                    transition: "color 0.15s ease",
                  }}
                >
                  {copied ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
                </button>
              </div>
            </div>

            {/* Display Name */}
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)",
                textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6,
              }}>Display Name</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text" value={displayName}
                  placeholder="Enter a display name..."
                  onChange={(e) => setDisplayName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveDisplayName()}
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: 6,
                    border: "1.5px solid var(--color-bg-subtle)", background: "var(--color-bg-base)",
                    fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", outline: "none",
                    fontFamily: "var(--font-body)",
                    boxSizing: "border-box",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--color-gold-primary)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "var(--color-bg-subtle)"; handleSaveDisplayName(); }}
                />
                <button
                  onClick={handleSaveDisplayName}
                  style={{
                    padding: "10px 20px", borderRadius: 6,
                    border: "none",
                    background: saved ? "var(--color-success)" : "var(--color-gold-primary)",
                    color: "var(--color-accent-fg)",
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                    fontFamily: "var(--font-body)",
                    transition: "background 0.15s ease",
                    display: "flex", alignItems: "center", gap: 6,
                    flexShrink: 0,
                  }}
                >
                  {saved ? <><CheckIcon /> Saved</> : "Save"}
                </button>
              </div>
              <div style={{
                fontSize: 11, color: "var(--color-text-faint)", marginTop: 6,
              }}>
                This is how other players see you in friend lists and matches
              </div>
            </div>

            {/* Logout */}
            <div style={{
              paddingTop: 12, borderTop: "1px solid var(--color-bg-subtle)",
            }}>
              <button
                onClick={logout}
                style={{
                  padding: "10px 20px", borderRadius: 6,
                  border: "1.5px solid var(--color-danger)",
                  background: "rgba(204,68,68,0.08)",
                  color: "var(--color-danger)",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                Sign Out
              </button>
            </div>
          </Card>

          {/* ═══ APPEARANCE ═══════════════════════════════════ */}
          <Card style={{ marginBottom: 16 }}>
            <SectionLabel>Appearance</SectionLabel>
            <div>
              <div style={{
                fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 8,
              }}>Theme</div>
              <SegmentToggle
                segments={BOARD_THEMES}
                activeId={theme}
                onSelect={(id) => setTheme(id as "light" | "dark" | "lux")}
              />
              <div style={{
                fontSize: 11, color: "var(--color-text-faint)", marginTop: 8,
              }}>
                Applies to the entire application
              </div>
            </div>
          </Card>

          {/* ═══ GAME PREFERENCES ═════════════════════════════ */}
          <Card style={{ marginBottom: 16 }}>
            <SectionLabel>Game Preferences</SectionLabel>
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 8,
              }}>Notation Style</div>
              <SegmentToggle
                segments={NOTATION_STYLES}
                activeId={notationStyle}
                onSelect={setNotationStyle}
              />
            </div>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)" }}>Auto-Confirm Moves</div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                  Automatically confirm obvious forced moves
                </div>
              </div>
              <ToggleSwitch on={autoConfirm} onToggle={() => setAutoConfirm(!autoConfirm)} />
            </div>
          </Card>

          {/* ═══ NOTIFICATIONS ════════════════════════════════ */}
          <Card style={{ marginBottom: 16 }}>
            <SectionLabel>Notifications</SectionLabel>
            {[
              { key: "matchInvites" as const, label: "Match Invites", desc: "Get notified when friends challenge you" },
              { key: "friendRequests" as const, label: "Friend Requests", desc: "Alerts for new friend requests" },
            ].map((item, i) => (
              <div key={item.key} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 0",
                borderBottom: i < 2 ? "1px solid var(--color-bg-subtle)" : "none",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>{item.desc}</div>
                </div>
                <ToggleSwitch
                  on={notifications[item.key]}
                  onToggle={() => setNotifications({
                    ...notifications,
                    [item.key]: !notifications[item.key],
                  })}
                />
              </div>
            ))}
          </Card>

          {/* Wallet section hidden for now */}

        </div>
      </main>
    </div>
  );
}
