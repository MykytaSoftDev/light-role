"use client";

/**
 * CL-5 — Step 2: Generation Settings.
 *
 * Three radio groups (Style / Tone / Length) of three cards each.
 * Cards are `<button role="radio">` inside a `<div role="radiogroup">` with
 * arrow-key navigation per WAI-ARIA radiogroup pattern (spec §3.5).
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Check, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

import type { CLLength, CLStyle, CLTone } from "@/types/cover-letter";

// ---------------------------------------------------------------------------
// Radio card primitives — colocated. Promote to /components/ui/ if reused.
// ---------------------------------------------------------------------------

interface RadioCardProps<T extends string> {
  value: T;
  selected: boolean;
  title: string;
  description: string;
  onSelect: (v: T) => void;
  /** Provided by the group so arrow-key navigation can call .focus(). */
  buttonRef?: (el: HTMLButtonElement | null) => void;
  groupId: string;
}

function RadioCard<T extends string>({
  value,
  selected,
  title,
  description,
  onSelect,
  buttonRef,
  groupId,
}: RadioCardProps<T>) {
  return (
    <button
      ref={buttonRef}
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={selected ? 0 : -1}
      data-group={groupId}
      onClick={() => onSelect(value)}
      className={cn(
        "relative flex min-h-[88px] flex-col items-start gap-1.5 rounded-lg border bg-card p-4 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border hover:border-primary/40 hover:bg-muted/30",
      )}
    >
      {selected && (
        <Check
          className="absolute right-2 top-2 h-4 w-4 text-primary"
          aria-hidden="true"
        />
      )}
      <span
        className={cn(
          "text-sm font-semibold",
          selected ? "text-primary" : "text-foreground",
        )}
      >
        {title}
      </span>
      <span className="mt-0.5 text-xs text-muted-foreground">{description}</span>
    </button>
  );
}

interface RadioCardGroupProps<T extends string> {
  label: string;
  groupId: string;
  options: { value: T; title: string; description: string }[];
  selected: T;
  onChange: (v: T) => void;
}

function RadioCardGroup<T extends string>({
  label,
  groupId,
  options,
  selected,
  onChange,
}: RadioCardGroupProps<T>) {
  const labelId = `${groupId}-label`;
  const buttonRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (
      e.key !== "ArrowLeft" &&
      e.key !== "ArrowRight" &&
      e.key !== "ArrowUp" &&
      e.key !== "ArrowDown"
    ) {
      return;
    }
    e.preventDefault();
    const currentIdx = options.findIndex((o) => o.value === selected);
    const delta = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
    const nextIdx = (currentIdx + delta + options.length) % options.length;
    const next = options[nextIdx];
    onChange(next.value);
    buttonRefs.current[nextIdx]?.focus();
  }

  return (
    <div className="space-y-2">
      <Label id={labelId} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        onKeyDown={handleKeyDown}
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      >
        {options.map((opt, idx) => (
          <RadioCard
            key={opt.value}
            value={opt.value}
            selected={selected === opt.value}
            title={opt.title}
            description={opt.description}
            onSelect={onChange}
            buttonRef={(el) => {
              buttonRefs.current[idx] = el;
            }}
            groupId={groupId}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2
// ---------------------------------------------------------------------------

interface Step2Props {
  style: CLStyle;
  tone: CLTone;
  length: CLLength;
  onStyleChange: (v: CLStyle) => void;
  onToneChange: (v: CLTone) => void;
  onLengthChange: (v: CLLength) => void;
  onBack: () => void;
  onGenerate: () => void;
}

export function Step2Settings({
  style,
  tone,
  length,
  onStyleChange,
  onToneChange,
  onLengthChange,
  onBack,
  onGenerate,
}: Step2Props) {
  const t = useTranslations("coverLetters.wizard");

  const styleOptions: { value: CLStyle; title: string; description: string }[] = [
    {
      value: "job_matched",
      title: t("step2.style.jobMatched.title"),
      description: t("step2.style.jobMatched.desc"),
    },
    {
      value: "formal",
      title: t("step2.style.formal.title"),
      description: t("step2.style.formal.desc"),
    },
    {
      value: "professional",
      title: t("step2.style.professional.title"),
      description: t("step2.style.professional.desc"),
    },
  ];

  const toneOptions: { value: CLTone; title: string; description: string }[] = [
    {
      value: "confident",
      title: t("step2.tone.confident.title"),
      description: t("step2.tone.confident.desc"),
    },
    {
      value: "humble",
      title: t("step2.tone.humble.title"),
      description: t("step2.tone.humble.desc"),
    },
    {
      value: "enthusiastic",
      title: t("step2.tone.enthusiastic.title"),
      description: t("step2.tone.enthusiastic.desc"),
    },
  ];

  const lengthOptions: { value: CLLength; title: string; description: string }[] = [
    {
      value: "short",
      title: t("step2.length.short.title"),
      description: t("step2.length.short.desc"),
    },
    {
      value: "medium",
      title: t("step2.length.medium.title"),
      description: t("step2.length.medium.desc"),
    },
    {
      value: "long",
      title: t("step2.length.long.title"),
      description: t("step2.length.long.desc"),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("step2.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioCardGroup
          label={t("step2.styleLabel")}
          groupId="cl-style"
          options={styleOptions}
          selected={style}
          onChange={onStyleChange}
        />
        <RadioCardGroup
          label={t("step2.toneLabel")}
          groupId="cl-tone"
          options={toneOptions}
          selected={tone}
          onChange={onToneChange}
        />
        <RadioCardGroup
          label={t("step2.lengthLabel")}
          groupId="cl-length"
          options={lengthOptions}
          selected={length}
          onChange={onLengthChange}
        />

        {/* Footer */}
        <div className="flex justify-between gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {t("common.back")}
          </Button>
          <Button type="button" onClick={onGenerate}>
            <Sparkles className="mr-1.5 h-4 w-4" />
            {t("step2.generate")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
