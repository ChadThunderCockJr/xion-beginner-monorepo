import { cn } from "@xion-beginner/ui";

interface StatCellProps {
  label: string;
  value: string | number;
  highlight?: boolean;
  className?: string;
}

export function StatCell({ label, value, highlight, className }: StatCellProps) {
  return (
    <div className={cn("text-center", className)}>
      <div
        className={cn(
          "text-xl font-bold font-mono tabular-nums tracking-tight",
          highlight ? "text-gold-primary" : "text-text-primary",
        )}
      >
        {value}
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.04em] text-text-muted mt-0.5">
        {label}
      </div>
    </div>
  );
}
