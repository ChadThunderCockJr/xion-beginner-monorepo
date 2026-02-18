import { cn } from "@xion-beginner/ui";
import { Avatar } from "./Avatar";

interface PlayerRowProps {
  name: string;
  rating: number;
  online?: boolean;
  action?: React.ReactNode;
  className?: string;
}

export function PlayerRow({ name, rating, online, action, className }: PlayerRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 py-2 px-1",
        className,
      )}
    >
      <Avatar name={name} size="sm" online={online} />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-text-primary truncate block">
          {name}
        </span>
      </div>
      <span className="text-sm font-mono font-semibold tabular-nums text-gold-primary">
        {rating}
      </span>
      {action}
    </div>
  );
}
