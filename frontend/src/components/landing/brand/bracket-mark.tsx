import { cn } from "@/lib/utils";

interface BracketMarkProps {
  size?: number;
  standalone?: boolean;
  className?: string;
}

export function BracketMark({ size = 30, standalone = false, className }: BracketMarkProps) {
  const svg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path
        d="M 60 32 L 32 32 L 32 168 L 60 168"
        stroke="var(--color-primary)"
        strokeWidth="16"
        fill="none"
      />
      <path
        d="M 140 32 L 168 32 L 168 168 L 140 168"
        stroke="var(--color-primary)"
        strokeWidth="16"
        fill="none"
      />
      <path
        d="M 80 52 L 80 148 L 132 148"
        stroke="var(--color-foreground)"
        strokeWidth="18"
        strokeLinejoin="miter"
        fill="none"
      />
    </svg>
  );

  if (standalone) {
    return (
      <span
        role="img"
        aria-label="Light Role"
        className={cn("inline-flex", className)}
      >
        {svg}
      </span>
    );
  }

  return (
    <span aria-hidden="true" className={cn("inline-flex", className)}>
      {svg}
    </span>
  );
}
