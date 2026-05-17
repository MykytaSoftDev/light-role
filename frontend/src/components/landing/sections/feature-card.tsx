import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { MonoTag } from "../chrome/mono-tag";

interface FeatureCardProps {
  num: string;
  tag: string;
  title: string;
  body: string;
  tone?: "default" | "primary";
  shot: React.ReactNode;
  className?: string;
}

export function FeatureCard({
  num,
  tag,
  title,
  body,
  tone = "default",
  shot,
  className,
}: FeatureCardProps) {
  return (
    <Card
      className={cn(
        "rounded-[14px] min-h-[460px] flex flex-col overflow-hidden border-[var(--color-border)] shadow-none",
        tone === "primary"
          ? "bg-[var(--color-primary-subtle)]"
          : "bg-[var(--color-background)]",
        className,
      )}
    >
      <CardHeader className="px-7 pt-7 pb-3 flex flex-col gap-3 space-y-0">
        <MonoTag
          className={
            tone === "primary"
              ? "text-[var(--color-primary)]"
              : "text-[var(--color-primary)]"
          }
        >
          {num.padStart(2, "0")} · {tag}
        </MonoTag>
        <h3 className="m-0 font-display text-[26px] font-bold tracking-[-0.025em] leading-[1.1] text-[var(--color-foreground)]">
          {title}
        </h3>
        <p className="m-0 font-body text-[15px] leading-[1.55] text-[var(--color-muted-fg)] max-w-[460px]">
          {body}
        </p>
      </CardHeader>
      <CardContent className="flex-1 px-7 pb-7 pt-0">
        <div
          className={cn(
            "h-full min-h-[240px] border border-[var(--color-border)] rounded-[10px] overflow-hidden",
            tone === "primary"
              ? "bg-[var(--color-card)]"
              : "bg-[var(--color-background)]",
          )}
        >
          {shot}
        </div>
      </CardContent>
    </Card>
  );
}
