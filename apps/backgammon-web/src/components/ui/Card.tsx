import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "@xion-beginner/ui";

type CardPadding = "none" | "sm" | "md" | "lg";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
}

const paddingValues: Record<CardPadding, number | undefined> = {
  none: 0,
  sm: 16,
  md: 20,
  lg: 36,
};

export function Card({ padding = "md", className, style, ...props }: CardProps) {
  const mergedStyle: CSSProperties = {
    padding: paddingValues[padding],
    ...style,
  };

  return (
    <div
      className={cn(
        "bg-bg-surface border border-bg-subtle rounded-[var(--radius-card)] shadow-card",
        className,
      )}
      style={mergedStyle}
      {...props}
    />
  );
}
