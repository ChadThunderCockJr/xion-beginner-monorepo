"use client";

import { cn } from "@xion-beginner/ui";

interface Tab {
  id: string;
  label: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export function TabBar({ tabs, activeTab, onTabChange, className }: TabBarProps) {
  return (
    <div className={cn("flex", className)}>
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex-1 py-3.5 text-[13px] transition-colors relative cursor-pointer bg-transparent border-none",
              active
                ? "text-text-primary font-bold"
                : "text-text-muted font-medium hover:text-text-secondary",
            )}
            style={{
              borderBottom: `2.5px solid ${active ? "var(--color-gold-primary)" : "transparent"}`,
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
