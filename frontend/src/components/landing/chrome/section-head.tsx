import { cn } from "@/lib/utils";

import { BracketTag } from "./bracket-tag";

interface SectionHeadProps {
  num?: string;
  kicker: string;
  title: string;
  sub?: string;
  align?: "left" | "center";
  className?: string;
  headingId?: string;
}

export function SectionHead({ num, kicker, title, sub, align = "left", className, headingId }: SectionHeadProps) {
  const isCenter = align === "center";
  return (
    <div
      className={cn(
        "flex flex-col gap-[18px] max-w-[720px]",
        isCenter ? "items-center text-center mx-auto" : "items-start text-left",
        className,
      )}
    >
      <BracketTag num={num} label={kicker} />
      <h2 id={headingId} className="font-display text-[48px] font-bold tracking-[-0.035em] leading-[1.05] text-[var(--color-foreground)] m-0">
        {title}
      </h2>
      {sub && (
        <p className="font-body text-[18px] leading-[1.5] text-[var(--color-muted-fg)] max-w-[560px] m-0">
          {sub}
        </p>
      )}
    </div>
  );
}
