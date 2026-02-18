import { cn } from "@xion-beginner/ui";

type BadgeVariant = "gold" | "win" | "loss" | "draw" | "default";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  gold: "bg-gold-muted text-burgundy-light",
  win: "bg-success-muted text-success",
  loss: "bg-danger-muted text-danger",
  draw: "bg-bg-subtle text-text-muted",
  default: "bg-bg-subtle text-text-secondary",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-[var(--radius-pill)] text-[11px] font-semibold",
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
