import { cn } from "@/lib/utils";

interface WordmarkProps {
  size?: number;
  className?: string;
}

export function Wordmark({ size = 20, className }: WordmarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "font-display font-bold leading-none whitespace-nowrap text-[var(--color-foreground)]",
        className,
      )}
      style={{
        fontSize: `${size}px`,
        letterSpacing: "-0.045em",
      }}
    >
      Light Role
    </span>
  );
}
