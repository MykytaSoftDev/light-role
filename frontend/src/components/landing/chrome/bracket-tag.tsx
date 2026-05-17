import { cn } from "@/lib/utils";

interface BracketTagProps {
  num?: string;
  label: string;
  className?: string;
}

export function BracketTag({ num, label, className }: BracketTagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--color-muted-fg)]",
        className,
      )}
    >
      <span className="text-[var(--color-primary)]">[</span>
      {num !== undefined && <span>{num.padStart(2, "0")}</span>}
      <span className="text-[var(--color-primary)]">]</span>
      <span aria-hidden="true">·</span>
      <span className="text-[var(--color-foreground)]">{label}</span>
    </span>
  );
}
