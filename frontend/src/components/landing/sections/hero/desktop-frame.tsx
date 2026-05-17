interface DesktopFrameProps {
  children: React.ReactNode;
  label?: string;
  height?: number;
  className?: string;
}

const TRAFFIC_LIGHTS = ["#ff5f57", "#febc2e", "#28c840"] as const;

export function DesktopFrame({
  children,
  label = "lightrole.com/dashboard",
  height = 520,
  className,
}: DesktopFrameProps) {
  return (
    <div
      className={`w-full overflow-hidden rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.18),0_2px_6px_rgba(0,0,0,0.04)] flex flex-col ${className ?? ""}`}
      style={{ height: `${height}px` }}
    >
      <div className="h-[34px] flex-none border-b border-[var(--color-border)] flex items-center gap-2 px-3 bg-[var(--color-background)]">
        <div className="flex gap-1.5">
          {TRAFFIC_LIGHTS.map((c) => (
            <span
              key={c}
              aria-hidden="true"
              className="w-[11px] h-[11px] rounded-full"
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="flex-1" />
        <div className="font-mono text-[11px] text-[var(--color-muted-fg)] tracking-[0.02em]">
          {label}
        </div>
        <div className="flex-1" />
      </div>
      <div className="flex-1 min-h-0 relative">{children}</div>
    </div>
  );
}
