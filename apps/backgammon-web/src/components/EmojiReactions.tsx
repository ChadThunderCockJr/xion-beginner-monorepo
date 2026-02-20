"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const REACTIONS = [
  { emoji: "\u{1F44D}", label: "Nice" },
  { emoji: "\u{1F604}", label: "Haha" },
  { emoji: "\u{1F62E}", label: "Wow" },
  { emoji: "\u{1F3B2}", label: "Lucky" },
  { emoji: "\u{1F914}", label: "Hmm" },
  { emoji: "\u{1F44F}", label: "GG" },
];

interface EmojiReactionsProps {
  onSend: (emoji: string) => void;
  incomingReaction?: { emoji: string; from: string } | null;
}

export function EmojiReactions({ onSend, incomingReaction }: EmojiReactionsProps) {
  const [open, setOpen] = useState(false);
  const [showIncoming, setShowIncoming] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Show incoming reaction animation
  useEffect(() => {
    if (incomingReaction) {
      setShowIncoming(true);
      const timer = setTimeout(() => setShowIncoming(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [incomingReaction]);

  const handleSend = useCallback(
    (emoji: string) => {
      onSend(emoji);
      setOpen(false);
    },
    [onSend],
  );

  return (
    <>
      {/* Reaction trigger + picker */}
      <div ref={pickerRef} style={{ position: "relative", display: "inline-flex" }}>
        <button
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Send emoji reaction"
          className="cursor-pointer transition-colors"
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: "1px solid var(--color-border-subtle)",
            background: open ? "var(--color-bg-elevated)" : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1rem",
            color: "var(--color-text-muted)",
          }}
        >
          {"\u{1F600}"}
        </button>

        {open && (
          <div
            style={{
              position: "absolute",
              bottom: "calc(100% + 6px)",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: 4,
              padding: "6px 8px",
              borderRadius: 10,
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border-subtle)",
              boxShadow: "var(--shadow-card)",
              zIndex: 50,
              whiteSpace: "nowrap",
            }}
          >
            {REACTIONS.map((r) => (
              <button
                key={r.label}
                onClick={() => handleSend(r.emoji)}
                aria-label={r.label}
                className="cursor-pointer transition-transform hover:scale-125"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 6,
                  border: "none",
                  background: "transparent",
                  fontSize: "1.25rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title={r.label}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Incoming reaction floating animation (positioned near top of game area) */}
      {showIncoming && incomingReaction && (
        <div
          style={{
            position: "absolute",
            top: 60,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 40,
            pointerEvents: "none",
            animation: "emoji-float 2s ease-out forwards",
          }}
        >
          <div
            style={{
              fontSize: "2.5rem",
              textShadow: "0 2px 8px rgba(0,0,0,0.4)",
              opacity: 1,
            }}
          >
            {incomingReaction.emoji}
          </div>
          <div
            style={{
              fontSize: "0.625rem",
              color: "var(--color-text-muted)",
              textAlign: "center",
              fontWeight: 600,
              fontFamily: "var(--font-body)",
            }}
          >
            {incomingReaction.from}
          </div>
        </div>
      )}

      {/* Keyframes for floating animation */}
      <style>{`
        @keyframes emoji-float {
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(10px) scale(0.8);
          }
          15% {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
          70% {
            opacity: 1;
            transform: translateX(-50%) translateY(-20px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateX(-50%) translateY(-40px) scale(0.9);
          }
        }
      `}</style>
    </>
  );
}
