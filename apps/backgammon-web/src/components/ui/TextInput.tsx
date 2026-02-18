import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@xion-beginner/ui";

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-[11px] font-semibold text-text-muted uppercase tracking-[0.1em]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full bg-bg-elevated rounded-[var(--radius-button)] py-[13px] px-4 text-[15px] text-text-primary placeholder:text-text-faint outline-none transition-[border-color] duration-200",
            error
              ? "border-[1.5px] border-danger focus:border-danger"
              : "border-[1.5px] border-bg-subtle focus:border-gold-primary",
            className,
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-danger">{error}</p>
        )}
      </div>
    );
  },
);
TextInput.displayName = "TextInput";
