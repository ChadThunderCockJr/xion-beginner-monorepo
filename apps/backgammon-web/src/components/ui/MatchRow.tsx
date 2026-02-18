import { cn } from "@xion-beginner/ui";
import { Avatar } from "./Avatar";
import { Badge } from "./Badge";

type MatchResult = "win" | "loss" | "draw";

interface MatchRowProps {
  opponent: string;
  result: MatchResult;
  score: string;
  matchLength: number;
  date: string;
  className?: string;
}

const resultBadge: Record<MatchResult, { label: string; variant: "win" | "loss" | "draw" }> = {
  win: { label: "W", variant: "win" },
  loss: { label: "L", variant: "loss" },
  draw: { label: "D", variant: "draw" },
};

export function MatchRow({ opponent, result, score, matchLength, date, className }: MatchRowProps) {
  const badge = resultBadge[result];

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-2.5 px-1 border-b border-bg-subtle last:border-b-0",
        className,
      )}
    >
      <Avatar name={opponent} size="sm" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-text-primary truncate block">
          {opponent}
        </span>
        <span className="text-[11px] text-text-faint">
          {matchLength}pt &middot; {date}
        </span>
      </div>
      <span className="text-sm font-mono font-semibold tabular-nums text-text-secondary">
        {score}
      </span>
      <Badge variant={badge.variant}>{badge.label}</Badge>
    </div>
  );
}
