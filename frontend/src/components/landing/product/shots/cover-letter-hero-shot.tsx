export interface CoverLetterPresetLabels {
  /** Selectable options for this preset row. */
  options: string[];
  /** Index of the currently active option (highlighted). */
  activeIndex: number;
}

export interface CoverLetterHeroShotLabels {
  style: CoverLetterPresetLabels;
  tone: CoverLetterPresetLabels;
  length: CoverLetterPresetLabels;
  draftLabel: string;
  greeting: string;
  body1Pre: string;
  body1Highlight: string;
  body1Post: string;
  body2Pre: string;
  body2Highlight: string;
  body2Post: string;
  signoff: string;
  name: string;
}

interface CoverLetterHeroShotProps {
  labels: CoverLetterHeroShotLabels;
}

function PresetRow({ preset }: { preset: CoverLetterPresetLabels }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {preset.options.map((opt, i) => {
        const active = i === preset.activeIndex;
        return (
          <span
            key={opt}
            className={
              active
                ? "font-mono text-[8px] tracking-[0.06em] px-1.5 py-0.5 rounded-full bg-[var(--color-primary-10)] text-[var(--color-primary)] border border-[var(--color-primary-20)]"
                : "font-mono text-[8px] tracking-[0.06em] px-1.5 py-0.5 rounded-full bg-[var(--color-background)] text-[var(--color-muted-fg)] border border-[var(--color-border)]"
            }
          >
            {opt}
          </span>
        );
      })}
    </div>
  );
}

export function CoverLetterHeroShot({ labels }: CoverLetterHeroShotProps) {
  return (
    <div className="w-full h-full flex flex-col bg-[var(--color-background)] font-display overflow-hidden">
      {/* Preset selectors */}
      <div className="flex flex-col gap-1.5 px-5 pt-4 pb-3 border-b border-[var(--color-border)]">
        <PresetRow preset={labels.style} />
        <PresetRow preset={labels.tone} />
        <PresetRow preset={labels.length} />
      </div>

      {/* Letter */}
      <div className="flex-1 min-h-0 px-6 py-4 overflow-hidden text-[10.5px] leading-[1.6] text-[var(--color-foreground)]">
        <div className="font-mono text-[9px] tracking-[0.12em] text-[var(--color-muted-fg)] uppercase mb-2.5">
          {labels.draftLabel}
        </div>
        <p className="m-0">{labels.greeting}</p>
        <p className="my-2 text-[var(--color-muted-fg)]">
          {labels.body1Pre}{" "}
          <span className="bg-[var(--color-primary-10)] text-[var(--color-foreground)] px-[3px] rounded-[3px]">
            {labels.body1Highlight}
          </span>{" "}
          {labels.body1Post}
        </p>
        <p className="my-2 text-[var(--color-muted-fg)]">
          {labels.body2Pre}{" "}
          <span className="bg-[var(--color-primary-10)] text-[var(--color-foreground)] px-[3px] rounded-[3px]">
            {labels.body2Highlight}
          </span>{" "}
          {labels.body2Post}
        </p>
        <p className="m-0 text-[var(--color-muted-fg)]">
          {labels.signoff}
          <br />
          {labels.name}
        </p>
      </div>
    </div>
  );
}
