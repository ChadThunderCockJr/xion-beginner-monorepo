"use client";

import { useState, useEffect } from "react";
import { Card, Avatar } from "@/components/ui";
import { useSocialContext } from "@/contexts/SocialContext";

// ── Icons ──────────────────────────────────────────────────────

const Icons = {
  search: (c = "var(--color-text-muted)") => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.5">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" strokeLinecap="round" />
    </svg>
  ),
  trophy: (c = "var(--color-text-muted)") => (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="1.5">
      <path d="M6 3h8v5a4 4 0 01-8 0V3z" />
      <path d="M6 5H4a2 2 0 00-2 2v1a3 3 0 003 3h1M14 5h2a2 2 0 012 2v1a3 3 0 01-3 3h-1" />
      <path d="M8 14h4M10 12v2M7 16h6" strokeLinecap="round" />
    </svg>
  ),
  userOnline: (c = "var(--color-text-muted)") => (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="1.5">
      <circle cx="10" cy="7" r="3" />
      <path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
      <circle cx="15" cy="6" r="2.5" fill="var(--color-success)" stroke="var(--color-bg-surface)" />
    </svg>
  ),
  star: (c = "var(--color-text-muted)") => (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="1.5">
      <path d="M10 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3L10 14.1l-4.8 2.5.9-5.3L2.3 7.6l5.3-.8L10 2z" />
    </svg>
  ),
  swords: (c = "var(--color-text-muted)") => (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="1.5">
      <path d="M3 3l6 6M9 3L3 9M17 3l-6 6M11 3l6 6M10 12v5M8 15h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  userPlus: (c = "var(--color-text-muted)") => (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="1.5">
      <circle cx="8" cy="7" r="3" />
      <path d="M2 17c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
      <path d="M16 6v4M14 8h4" strokeLinecap="round" />
    </svg>
  ),
  check: (c = "var(--color-success)") => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="2">
      <path d="M3 8.5l3.5 3.5L13 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  x: (c = "var(--color-danger)") => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="2">
      <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
    </svg>
  ),
};

// ── Helpers ─────────────────────────────────────────────────────

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function displayLabel(friend: { displayName: string; address: string }): string {
  return friend.displayName || friend.address.slice(0, 12) + "...";
}

// ── Friend Row ─────────────────────────────────────────────────

function FriendRow({
  name,
  online,
  onChallenge,
  onRemove,
}: {
  name: string;
  online: boolean;
  onChallenge: () => void;
  onRemove: () => void;
}) {
  const [h, setH] = useState(false);
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
        borderBottom: "1px solid var(--color-bg-subtle)",
      }}
    >
      <Avatar name={name} size="sm" online={online} />
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            fontFamily: "var(--font-body)",
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: 11,
            color: online ? "var(--color-success)" : "var(--color-text-muted)",
            fontFamily: "var(--font-body)",
          }}
        >
          {online ? "Online" : "Offline"}
        </div>
      </div>
      {online && (
        <button
          onClick={onChallenge}
          style={{
            padding: "4px 12px",
            borderRadius: 6,
            border: h
              ? "1px solid var(--color-gold-primary)"
              : "1px solid var(--color-bg-subtle)",
            background: h ? "var(--color-gold-muted)" : "transparent",
            fontSize: 11,
            fontWeight: 600,
            color: h ? "var(--color-gold-primary)" : "var(--color-text-muted)",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            transition: "all 0.15s ease",
          }}
        >
          Challenge
        </button>
      )}
      <button
        onClick={onRemove}
        style={{
          padding: "4px 8px",
          borderRadius: 6,
          border: "1px solid transparent",
          background: "transparent",
          fontSize: 11,
          color: "var(--color-text-faint)",
          cursor: "pointer",
          fontFamily: "var(--font-body)",
          transition: "all 0.15s ease",
        }}
        title="Remove friend"
      >
        {Icons.x("var(--color-text-faint)")}
      </button>
    </div>
  );
}

// ── Friend Request Row ─────────────────────────────────────────

function RequestRow({
  name,
  onAccept,
  onReject,
}: {
  name: string;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
        borderBottom: "1px solid var(--color-bg-subtle)",
      }}
    >
      <Avatar name={name} size="sm" />
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            fontFamily: "var(--font-body)",
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-body)",
          }}
        >
          Wants to be friends
        </div>
      </div>
      <button
        onClick={onAccept}
        style={{
          padding: "4px 10px",
          borderRadius: 6,
          border: "1px solid var(--color-success)",
          background: "rgba(96,168,96,0.1)",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--color-success)",
          cursor: "pointer",
          fontFamily: "var(--font-body)",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {Icons.check()} Accept
      </button>
      <button
        onClick={onReject}
        style={{
          padding: "4px 10px",
          borderRadius: 6,
          border: "1px solid var(--color-bg-subtle)",
          background: "transparent",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--color-text-muted)",
          cursor: "pointer",
          fontFamily: "var(--font-body)",
        }}
      >
        Decline
      </button>
    </div>
  );
}

// ── Activity Row ───────────────────────────────────────────────

function ActivityRow({
  type,
  text,
  time,
  result,
}: {
  type: "match" | "friend_added" | "friend_online";
  text: string;
  time: string;
  result?: "W" | "L";
}) {
  const [h, setH] = useState(false);

  const icon =
    type === "match"
      ? Icons.swords(result === "W" ? "var(--color-success)" : result === "L" ? "var(--color-danger)" : "var(--color-text-muted)")
      : type === "friend_online"
        ? Icons.userOnline("var(--color-success)")
        : Icons.userPlus("var(--color-gold-primary)");

  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid var(--color-bg-subtle)",
        background: h ? "var(--color-bg-elevated)" : "transparent",
        borderRadius: h ? 6 : 0,
        transition: "all 0.12s ease",
        marginLeft: h ? -8 : 0,
        paddingLeft: h ? 8 : 0,
        marginRight: h ? -8 : 0,
        paddingRight: h ? 8 : 0,
      }}
    >
      <span style={{ display: "flex", flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--color-text-primary)",
            fontFamily: "var(--font-body)",
          }}
        >
          {text}
        </div>
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--color-text-faint)",
          fontFamily: "var(--font-body)",
          flexShrink: 0,
        }}
      >
        {time}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SOCIAL PAGE
// ═══════════════════════════════════════════════════════════════

export default function SocialPage() {
  const social = useSocialContext();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"online" | "offline" | "requests">("online");
  const [addQuery, setAddQuery] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  const filtered = social.friends.filter(
    (f) =>
      f.online === (tab === "online") &&
      (displayLabel(f).toLowerCase().includes(search.toLowerCase()) ||
        f.address.toLowerCase().includes(search.toLowerCase())),
  );

  const onlineCount = social.friends.filter((f) => f.online).length;
  const offlineCount = social.friends.filter((f) => !f.online).length;
  const requestCount = social.incomingRequests.length;

  // Debounced search
  useEffect(() => {
    if (addQuery.length >= 2) {
      const t = setTimeout(() => social.searchPlayers(addQuery), 300);
      return () => clearTimeout(t);
    }
  }, [addQuery, social]);

  const handleSendRequest = (address: string) => {
    social.sendFriendRequest(address);
    setSentTo(address);
    setTimeout(() => setSentTo(null), 3000);
  };

  return (
    <div className="p-4 md:px-6 lg:px-8 lg:py-6" style={{ width: "100%" }}>
      {/* Header */}
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
          Social
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--color-text-muted)",
            margin: "4px 0 0",
            fontFamily: "var(--font-body)",
          }}
        >
          {onlineCount} friend{onlineCount !== 1 ? "s" : ""} online
        </p>
      </header>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
        {/* LEFT COLUMN — Friends List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {/* Add Friend */}
          <Card>
            <h3
              style={{
                fontSize: 11,
                fontWeight: 600,
                margin: "0 0 12px",
                textTransform: "uppercase",
                letterSpacing: 1.5,
                color: "var(--color-text-muted)",
                fontFamily: "var(--font-body)",
              }}
            >
              Add Friend
            </h3>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                border: "1px solid var(--color-bg-subtle)",
                borderRadius: 6,
                background: "var(--color-bg-surface)",
              }}
            >
              {Icons.search("var(--color-text-faint)")}
              <input
                type="text"
                placeholder="Search by username or address..."
                value={addQuery}
                onChange={(e) => setAddQuery(e.target.value)}
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: 13,
                  color: "var(--color-text-primary)",
                  fontFamily: "var(--font-body)",
                }}
              />
            </div>
            {/* Search Results */}
            {addQuery.length >= 2 && (
              <div style={{ marginTop: 8 }}>
                {social.searchResults.length > 0 ? (
                  social.searchResults.map((r) => (
                    <div
                      key={r.address}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 0",
                        borderBottom: "1px solid var(--color-bg-subtle)",
                      }}
                    >
                      <Avatar name={r.displayName || r.username || r.address.slice(0, 6)} size="sm" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 600,
                          color: "var(--color-text-primary)",
                          fontFamily: "var(--font-body)",
                        }}>
                          {r.displayName || r.username}
                        </div>
                        {r.username && (
                          <div style={{
                            fontSize: 11, color: "var(--color-text-muted)",
                            fontFamily: "var(--font-mono)",
                          }}>
                            @{r.username}
                          </div>
                        )}
                      </div>
                      {social.friends.some((f) => f.address === r.address) ? (
                        <span style={{
                          fontSize: 11, color: "var(--color-text-faint)",
                          fontFamily: "var(--font-body)", fontWeight: 600,
                        }}>
                          Already friends
                        </span>
                      ) : sentTo === r.address ? (
                        <span style={{
                          fontSize: 11, color: "var(--color-success)",
                          fontFamily: "var(--font-body)", fontWeight: 600,
                          display: "flex", alignItems: "center", gap: 4,
                        }}>
                          {Icons.check()} Sent
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSendRequest(r.address)}
                          style={{
                            padding: "4px 12px",
                            borderRadius: 6,
                            border: "1px solid var(--color-gold-primary)",
                            background: "var(--color-gold-muted)",
                            fontSize: 11,
                            fontWeight: 600,
                            color: "var(--color-gold-primary)",
                            cursor: "pointer",
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          Add Friend
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{
                    padding: "12px 0",
                    textAlign: "center",
                    fontSize: 12,
                    color: "var(--color-text-faint)",
                    fontFamily: "var(--font-body)",
                  }}>
                    No players found for &ldquo;{addQuery}&rdquo;
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card>
            {/* Section Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <h3
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  color: "var(--color-text-muted)",
                  fontFamily: "var(--font-body)",
                }}
              >
                Friends
              </h3>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--color-text-faint)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {social.friends.length}
              </span>
            </div>

            {/* Search Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                border: "1px solid var(--color-bg-subtle)",
                borderRadius: 6,
                background: "var(--color-bg-surface)",
                marginBottom: 16,
              }}
            >
              {Icons.search("var(--color-text-faint)")}
              <input
                type="text"
                placeholder="Search friends..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: 13,
                  color: "var(--color-text-primary)",
                  fontFamily: "var(--font-body)",
                  width: "100%",
                }}
              />
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {([
                { id: "online" as const, label: `Online (${onlineCount})` },
                { id: "offline" as const, label: `Offline (${offlineCount})` },
                { id: "requests" as const, label: `Requests${requestCount > 0 ? ` (${requestCount})` : ""}` },
              ]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    flex: 1,
                    padding: "8px 14px",
                    borderRadius: 6,
                    border:
                      tab === t.id
                        ? "1px solid var(--color-gold-primary)"
                        : "1px solid var(--color-bg-subtle)",
                    background:
                      tab === t.id ? "var(--color-gold-muted)" : "transparent",
                    fontSize: 13,
                    fontWeight: 600,
                    color:
                      tab === t.id
                        ? "var(--color-gold-primary)"
                        : "var(--color-text-muted)",
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                    transition: "all 0.15s ease",
                    position: "relative",
                  }}
                >
                  {t.label}
                  {t.id === "requests" && requestCount > 0 && tab !== "requests" && (
                    <span
                      style={{
                        position: "absolute",
                        top: -4,
                        right: -4,
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "var(--color-danger)",
                      }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Friend List / Requests */}
            {tab === "requests" ? (
              social.incomingRequests.length > 0 ? (
                social.incomingRequests.map((r) => (
                  <RequestRow
                    key={r.address}
                    name={r.displayName || r.address.slice(0, 12) + "..."}
                    onAccept={() => social.acceptFriendRequest(r.address)}
                    onReject={() => social.rejectFriendRequest(r.address)}
                  />
                ))
              ) : (
                <div
                  style={{
                    padding: "24px 0",
                    textAlign: "center",
                    fontSize: 13,
                    color: "var(--color-text-faint)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  No pending friend requests
                </div>
              )
            ) : filtered.length > 0 ? (
              filtered.map((f) => (
                <FriendRow
                  key={f.address}
                  name={displayLabel(f)}
                  online={f.online}
                  onChallenge={() => social.challengeFriend(f.address)}
                  onRemove={() => social.removeFriend(f.address)}
                />
              ))
            ) : (
              <div
                style={{
                  padding: "24px 0",
                  textAlign: "center",
                  fontSize: 13,
                  color: "var(--color-text-faint)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {social.friends.length === 0
                  ? "No friends yet. Add someone above!"
                  : "No friends found"}
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT COLUMN — Activity Feed */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <h3
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  color: "var(--color-text-muted)",
                  fontFamily: "var(--font-body)",
                }}
              >
                Recent Activity
              </h3>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--color-text-faint)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {social.activity.length}
              </span>
            </div>

            {social.activity.length > 0 ? (
              social.activity.map((a, i) => (
                <ActivityRow
                  key={i}
                  type={a.type}
                  text={a.text}
                  time={formatRelativeTime(a.timestamp)}
                  result={a.type === "match" ? a.result : undefined}
                />
              ))
            ) : (
              <div
                style={{
                  padding: "32px 0",
                  textAlign: "center",
                  fontSize: 13,
                  color: "var(--color-text-faint)",
                  fontFamily: "var(--font-body)",
                }}
              >
                No activity yet. Play some games!
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
