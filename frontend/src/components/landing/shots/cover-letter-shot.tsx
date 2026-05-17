interface CoverLetterShotProps {
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

export function CoverLetterShot({
  draftLabel,
  greeting,
  body1Pre,
  body1Highlight,
  body1Post,
  body2Pre,
  body2Highlight,
  body2Post,
  signoff,
  name,
}: CoverLetterShotProps) {
  return (
    <div className="w-full h-full p-[18px] bg-[var(--color-background)] font-display text-[10.5px] leading-[1.6] text-[var(--color-foreground)] overflow-hidden">
      <div className="font-mono text-[9px] tracking-[0.12em] text-[var(--color-muted-fg)] uppercase mb-2">
        {draftLabel}
      </div>
      <p className="m-0">{greeting}</p>
      <p className="my-2 text-[var(--color-muted-fg)]">
        {body1Pre}{" "}
        <span className="bg-[var(--color-primary-10)] text-[var(--color-foreground)] px-[3px] rounded-[3px]">
          {body1Highlight}
        </span>{" "}
        {body1Post}
      </p>
      <p className="my-2 text-[var(--color-muted-fg)]">
        {body2Pre}{" "}
        <span className="bg-[var(--color-primary-10)] text-[var(--color-foreground)] px-[3px] rounded-[3px]">
          {body2Highlight}
        </span>{" "}
        {body2Post}
      </p>
      <p className="m-0 text-[var(--color-muted-fg)]">
        {signoff}
        <br />
        {name}
      </p>
    </div>
  );
}
