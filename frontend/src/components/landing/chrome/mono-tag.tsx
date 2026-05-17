import { cn } from "@/lib/utils";

interface MonoTagProps {
  children: React.ReactNode;
  className?: string;
}

export function MonoTag({ children, className }: MonoTagProps) {
  return (
    <span
      className={cn(
        "font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-muted-fg)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
