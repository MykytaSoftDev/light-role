interface DotProps {
  color?: string;
  size?: number;
  className?: string;
}

export function Dot({ color = "var(--color-primary)", size = 8, className }: DotProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block rounded-full ${className ?? ""}`}
      style={{ width: `${size}px`, height: `${size}px`, background: color }}
    />
  );
}
