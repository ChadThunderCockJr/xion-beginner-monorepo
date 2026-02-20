import { cn } from "@xion-beginner/ui";

type AvatarSize = "xs" | "sm" | "md" | "lg";

interface AvatarProps {
  name: string;
  size?: AvatarSize;
  online?: boolean;
  className?: string;
}

const sizeStyles: Record<AvatarSize, { container: string; text: string; dot: string }> = {
  xs: { container: "w-6 h-6", text: "text-[9px]", dot: "w-1.5 h-1.5 -bottom-0.5 -right-0.5" },
  sm: { container: "w-8 h-8", text: "text-[12px]", dot: "w-2 h-2 -bottom-0.5 -right-0.5" },
  md: { container: "w-9 h-9", text: "text-[14px]", dot: "w-2.5 h-2.5 -bottom-0.5 -right-0.5" },
  lg: { container: "w-11 h-11", text: "text-[17px]", dot: "w-3 h-3 bottom-0 right-0" },
};

export function Avatar({ name, size = "md", online, className }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const s = sizeStyles[size];

  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      <div
        className={cn(
          "rounded-full bg-bg-elevated border-2 border-border-subtle flex items-center justify-center font-bold text-text-secondary",
          s.container,
          s.text,
        )}
      >
        {initials}
      </div>
      {online !== undefined && (
        <span
          className={cn(
            "absolute rounded-full border-2 border-bg-deepest",
            online ? "bg-success" : "bg-text-faint",
            s.dot,
          )}
        />
      )}
    </div>
  );
}
