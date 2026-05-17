interface KwInlineProps {
  children: React.ReactNode;
  colorId?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  animate?: boolean;
  delayMs?: number;
  className?: string;
}

export function KwInline({
  children,
  colorId = 1,
  animate = false,
  delayMs = 0,
  className,
}: KwInlineProps) {
  const style: React.CSSProperties = {
    backgroundColor: `var(--keyword-chip-bg-${colorId})`,
    color: `var(--keyword-chip-fg-${colorId})`,
  };
  if (animate) {
    style.animation = `lr-keyword-pop 600ms ease-out ${delayMs}ms both`;
  }
  return (
    <span
      className={`px-1 rounded-[3px] font-medium ${className ?? ""}`}
      style={style}
    >
      {children}
    </span>
  );
}
