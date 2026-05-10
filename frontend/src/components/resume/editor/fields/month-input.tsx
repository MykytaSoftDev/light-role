"use client";

/**
 * TAILOR-10 — Month/year picker.
 *
 * Spec: docs/v2/specs/editor-edit-mode-spec.md §7.0.5.
 *
 * Stores ISO `YYYY-MM` strings (matches `ProfileData` schema for
 * employment.start_date, education.end_date, certificates.issue_date, etc).
 *
 * Implementation: shadcn Popover with two `<select>` elements (year + month).
 * We use native `<select>` to keep the popover visually compact and avoid
 * nesting Radix Select inside Radix Popover (which works but adds focus-mgmt
 * complexity for limited gain).
 *
 * Decision (per spec §7.0.5): chosen over `<input type="month">` because that
 * native input renders inconsistently across browsers (Safari iOS in particular)
 * and doesn't support optional/clearable values.
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, X as XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatMonth } from "@/app/(dashboard)/dashboard/profile/_components/tabs/_shared/format-month";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export interface MonthInputProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  placeholder?: string;
  /** Show the Clear button (sets value to null). For optional date fields. */
  clearable?: boolean;
  disabled?: boolean;
  /** Trigger className override. */
  className?: string;
  ariaLabel?: string;
}

export function MonthInput({
  value,
  onChange,
  placeholder,
  clearable = false,
  disabled = false,
  className,
  ariaLabel,
}: MonthInputProps) {
  const t = useTranslations("Resumes.editor.fields");
  const tCommon = useTranslations("Common.actions");
  const resolvedPlaceholder = placeholder ?? t("monthSelectPlaceholder");
  const [open, setOpen] = React.useState(false);

  // Parse current value into year + month indexes (0-11). When value is
  // missing, default the popover's initial selection to the current month.
  const now = new Date();
  const currentYear = now.getFullYear();
  const minYear = currentYear - 60;
  const maxYear = currentYear + 5;

  const parsed = parseYM(value);
  const [yearDraft, setYearDraft] = React.useState<number>(
    parsed?.year ?? currentYear
  );
  const [monthDraft, setMonthDraft] = React.useState<number>(
    parsed?.month ?? now.getMonth()
  );

  // Re-sync drafts whenever the popover opens, so re-opening shows the actual
  // current value rather than a stale local state.
  React.useEffect(() => {
    if (open) {
      const p = parseYM(value);
      if (p) {
        setYearDraft(p.year);
        setMonthDraft(p.month);
      } else {
        setYearDraft(currentYear);
        setMonthDraft(now.getMonth());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function commit(year: number, monthIdx: number) {
    const mm = String(monthIdx + 1).padStart(2, "0");
    onChange(`${year}-${mm}`);
  }

  const display = value ? formatMonth(value, "") : "";

  // Years descending (most recent first) — common pattern for resume dates.
  const years = React.useMemo(() => {
    const out: number[] = [];
    for (let y = maxYear; y >= minYear; y--) out.push(y);
    return out;
  }, [maxYear, minYear]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel ?? t("pickMonthYearAria")}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border border-transparent",
            "hover:border-border focus:border-primary focus:outline-none",
            "px-1 py-0.5 text-sm",
            "min-w-0",
            !display && "text-muted-foreground",
            className
          )}
        >
          <CalendarDays className="h-3.5 w-3.5 opacity-60" />
          <span className="truncate">{display || resolvedPlaceholder}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              {t("yearLabel")}
            </span>
            <select
              value={yearDraft}
              onChange={(e) => {
                const y = Number(e.target.value);
                setYearDraft(y);
                commit(y, monthDraft);
              }}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              {t("monthLabel")}
            </span>
            <select
              value={monthDraft}
              onChange={(e) => {
                const m = Number(e.target.value);
                setMonthDraft(m);
                commit(yearDraft, m);
              }}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              {MONTHS.map((label, idx) => (
                <option key={label} value={idx}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          {clearable ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <XIcon className="h-3.5 w-3.5" />
              {tCommon("clear")}
            </Button>
          ) : (
            <span />
          )}
          <Button
            type="button"
            size="sm"
            className="h-8"
            onClick={() => setOpen(false)}
          >
            {t("doneButton")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function parseYM(
  value: string | null | undefined
): { year: number; month: number } | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  if (Number.isNaN(year) || month < 0 || month > 11) return null;
  return { year, month };
}
