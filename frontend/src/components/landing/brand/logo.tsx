import { cn } from "@/lib/utils";

import { BracketMark } from "./bracket-mark";
import { Wordmark } from "./wordmark";

interface LogoProps {
  size?: number;
  gap?: number;
  className?: string;
}

export function Logo({ size = 30, gap = 10, className }: LogoProps) {
  return (
    <span
      role="img"
      aria-label="Light Role"
      className={cn("inline-flex items-center", className)}
      style={{ gap: `${gap}px` }}
    >
      <BracketMark size={size} />
      <Wordmark size={Math.round(size * 0.66)} />
    </span>
  );
}
