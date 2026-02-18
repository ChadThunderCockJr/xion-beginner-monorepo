import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@xion-beginner/ui";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-gold-primary text-[var(--color-accent-fg)] font-semibold hover:bg-gold-light hover:shadow-gold active:bg-gold-dark active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed",
  secondary:
    "bg-bg-surface text-text-primary border border-bg-subtle font-semibold hover:bg-bg-elevated hover:border-gold-dark active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed",
  ghost:
    "bg-transparent text-text-muted hover:text-gold-primary active:scale-[0.98]",
  destructive:
    "bg-transparent text-danger border border-danger/30 hover:bg-danger-muted hover:border-danger/50 active:scale-[0.98]",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "text-[13px] px-3.5 py-2 rounded-[var(--radius-button)]",
  md: "text-[15px] px-5 py-3.5 rounded-[var(--radius-button)]",
  lg: "text-base px-6 py-4 rounded-[var(--radius-button)]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", fullWidth, className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2.5 cursor-pointer transition-all duration-200",
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
