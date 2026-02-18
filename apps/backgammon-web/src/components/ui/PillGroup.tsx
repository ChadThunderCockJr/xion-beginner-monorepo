"use client";

import { cn } from "@xion-beginner/ui";

interface Pill {
  id: string;
  label: string;
}

interface PillGroupProps {
  pills: Pill[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
}

export function PillGroup({ pills, activeId, onSelect, className }: PillGroupProps) {
  return (
    <div className={cn("flex gap-1.5 flex-wrap", className)}>
      {pills.map((pill) => {
        const active = activeId === pill.id;
        return (
          <button
            key={pill.id}
            onClick={() => onSelect(pill.id)}
            className="rounded-[var(--radius-button)] text-[12px] font-semibold transition-all duration-[120ms] cursor-pointer"
            style={{
              padding: "7px 14px",
              border: `1.5px solid ${active ? "var(--color-gold-primary)" : "var(--color-bg-subtle)"}`,
              background: active ? "var(--color-gold-primary)" : "var(--color-bg-surface)",
              color: active ? "var(--color-accent-fg, var(--color-bg-deepest))" : "var(--color-text-secondary)",
            }}
          >
            {pill.label}
          </button>
        );
      })}
    </div>
  );
}
