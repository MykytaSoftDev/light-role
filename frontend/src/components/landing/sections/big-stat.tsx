import { MonoTag } from "@/components/landing/chrome/mono-tag";

interface BigStatProps {
  value: string;
  label: string;
}

export function BigStat({ value, label }: BigStatProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="font-display text-[56px] font-bold tracking-[-0.045em] leading-none text-[var(--color-foreground)]">
        {value}
      </div>
      <MonoTag>{label}</MonoTag>
    </div>
  );
}
