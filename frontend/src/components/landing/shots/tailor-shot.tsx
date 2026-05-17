import { KwInline } from "@/components/landing/sections/hero/kw-inline";

interface TailorShotProps {
  personName: string;
  personEmail: string;
  experienceLabel: string;
  matchLabel: string;
  role1: string;
  role1KwA: string;
  role1KwB: string;
  role1KwC: string;
  role2: string;
  role2KwA: string;
  role2KwB: string;
  role1Part1: string;
  role1Part2: string;
  role1Part3: string;
  role1Part4: string;
  role2Part1: string;
  role2Part2: string;
  role2Part3: string;
}

export function TailorShot({
  personName,
  personEmail,
  experienceLabel,
  matchLabel,
  role1,
  role1KwA,
  role1KwB,
  role1KwC,
  role2,
  role2KwA,
  role2KwB,
  role1Part1,
  role1Part2,
  role1Part3,
  role1Part4,
  role2Part1,
  role2Part2,
  role2Part3,
}: TailorShotProps) {
  return (
    <div className="w-full h-full p-[18px] bg-[var(--color-background)] flex flex-col gap-2 font-display">
      <div className="flex justify-between items-baseline">
        <div className="text-[13px] font-bold tracking-[-0.02em]">{personName}</div>
        <div className="font-mono text-[8px] text-[var(--color-muted-fg)]">
          {personEmail}
        </div>
      </div>
      <div className="font-mono text-[8px] tracking-[0.1em] text-[var(--color-primary)] uppercase mt-0.5">
        {experienceLabel}
      </div>
      <div className="text-[10.5px] font-semibold">{role1}</div>
      <div className="text-[9px] leading-[1.55] text-[var(--color-muted-fg)]">
        {role1Part1}
        <KwInline colorId={1}>{role1KwA}</KwInline>
        {role1Part2}
        <KwInline colorId={3}>{role1KwB}</KwInline>
        {role1Part3}
        <KwInline colorId={5}>{role1KwC}</KwInline>
        {role1Part4}
      </div>
      <div className="text-[10.5px] font-semibold mt-1">{role2}</div>
      <div className="text-[9px] leading-[1.55] text-[var(--color-muted-fg)]">
        {role2Part1}
        <KwInline colorId={3}>{role2KwA}</KwInline>
        {role2Part2}
        <KwInline colorId={4}>{role2KwB}</KwInline>
        {role2Part3}
      </div>
      <div className="mt-auto font-mono text-[9px] text-[var(--color-muted-fg)] border-t border-dashed border-[var(--color-border)] pt-1.5 flex justify-between">
        <span>{matchLabel}</span>
        <span className="text-[var(--color-primary)] font-bold">96%</span>
      </div>
    </div>
  );
}
