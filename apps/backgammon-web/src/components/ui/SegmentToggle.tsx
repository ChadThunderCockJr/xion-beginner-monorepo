"use client";

import { cn } from "@xion-beginner/ui";

interface Segment {
  id: string;
  label: string;
}

interface SegmentToggleProps {
  segments: Segment[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
}

export function SegmentToggle({ segments, activeId, onSelect, className }: SegmentToggleProps) {
  return (
    <div
      className={cn("flex overflow-hidden", className)}
      style={{
        borderRadius: "var(--radius-card)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      {segments.map((segment, i) => {
        const active = activeId === segment.id;
        return (
          <button
            key={segment.id}
            onClick={() => onSelect(segment.id)}
            style={{
              flex: 1,
              padding: "10px 0",
              background: active ? "var(--color-gold-primary)" : "var(--color-bg-surface)",
              color: active ? "var(--color-accent-fg, var(--color-bg-deepest))" : "var(--color-text-muted)",
              border: "none",
              borderLeft: i > 0 ? "1px solid var(--color-border-subtle)" : "none",
              fontSize: "0.8125rem",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "var(--font-body)",
            }}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}
