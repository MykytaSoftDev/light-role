"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UpgradeModal } from "@/components/shared/upgrade-modal";
import { api } from "@/lib/api";
import { parseLimitError } from "@/lib/api-errors";
import { cn } from "@/lib/utils";
import { useUpgradeModal } from "@/hooks/use-upgrade-modal";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CircleAlert,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTranslations } from "next-intl";

// ---------------------------------------------------------------------------
// Schema & types
// ---------------------------------------------------------------------------

function makeJobSchema(t: (key: string) => string) {
  return z.object({
    title: z.string().min(1, t("titleLabel") + ": " + t("invalidFieldsError")),
    company: z.string().min(1, t("companyLabel") + ": " + t("invalidFieldsError")),
    location: z.string().optional(),
    salary: z.string().optional(),
    description_raw: z.string().optional(),
    requirements: z.array(z.string()).optional(),
  });
}

type JobFormValues = z.infer<ReturnType<typeof makeJobSchema>>;

interface ParsedJob {
  job_title: string;
  company: string;
  requirements: string[];
  location: string;
  salary: string;
}

// ---------------------------------------------------------------------------
// Requirements tag input
// ---------------------------------------------------------------------------

interface RequirementsInputProps {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (index: number) => void;
}

function RequirementsInput({ tags, onAdd, onRemove }: RequirementsInputProps) {
  const tCommon = useTranslations("Common");
  const tJob = useTranslations("Jobs.new");
  const [inputValue, setInputValue] = useState("");

  function commitTag(raw: string) {
    const tag = raw.trim().replace(/,$/, "").trim();
    if (tag.length > 0) {
      onAdd(tag);
    }
    setInputValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitTag(inputValue);
    } else if (e.key === ",") {
      e.preventDefault();
      commitTag(inputValue);
    } else if (e.key === "Backspace" && inputValue === "" && tags.length > 0) {
      onRemove(tags.length - 1);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    // Auto-commit if user typed a comma mid-word
    if (val.endsWith(",")) {
      commitTag(val);
    } else {
      setInputValue(val);
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-10 w-full flex-wrap gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
        "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
      )}
    >
      {tags.map((tag, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
        >
          {tag}
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label={`${tCommon("actions.remove")} ${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? tJob("requirementsPlaceholder") : ""}
        className="min-w-[120px] flex-1 bg-transparent placeholder:text-muted-foreground outline-none text-sm"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewJobPage() {
  const router = useRouter();
  const t = useTranslations("Jobs.new");
  const tCommon = useTranslations("Common");
  const tAuth = useTranslations("Auth.common");

  // Module-level constants would resolve before useTranslations, so we keep
  // these inside the component.
  const LOADING_MESSAGES = (t.raw("parsingMessages") as string[]) ?? [];
  const jobSchema = makeJobSchema(t);

  // Mode: 'ai' or 'manual'
  const [mode, setMode] = useState<"ai" | "manual">("ai");

  // AI parse state
  const [rawText, setRawText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0] ?? "");
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Whether the review form is visible
  const [showForm, setShowForm] = useState(false);

  // Tags (requirements) managed separately from RHF due to array nature
  const [tags, setTags] = useState<string[]>([]);

  // Server-side error
  const [serverError, setServerError] = useState<string | null>(null);

  // Upgrade modal — MONETIZE-14: only the job-creation path can hit a credit
  // limit now (ACTIVE_JOBS_EXCEEDED). MONETIZE-3 removed the AI quota gate
  // from /jobs/parse, so the parse button no longer needs a usage probe.
  const { modalState, openFromCreditError, close: closeModal } = useUpgradeModal();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<JobFormValues>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      title: "",
      company: "",
      location: "",
      salary: "",
      description_raw: "",
      requirements: [],
    },
  });

  // Sync tags into RHF whenever they change
  useEffect(() => {
    setValue("requirements", tags);
  }, [tags, setValue]);

  // Cleanup loading interval on unmount
  useEffect(() => {
    return () => {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    };
  }, []);

  // ------------------------------------------------------------------
  // Mode switch
  // ------------------------------------------------------------------

  function handleModeChange(next: "ai" | "manual") {
    setMode(next);
    setServerError(null);

    if (next === "manual") {
      setShowForm(true);
      // Reset form to empty when switching to manual
      reset();
      setTags([]);
    } else {
      setShowForm(false);
    }
  }

  // ------------------------------------------------------------------
  // AI parse
  // ------------------------------------------------------------------

  function startLoadingMessages() {
    if (LOADING_MESSAGES.length === 0) return;
    let idx = 0;
    setLoadingMessage(LOADING_MESSAGES[0]);
    loadingIntervalRef.current = setInterval(() => {
      idx = (idx + 1) % LOADING_MESSAGES.length;
      setLoadingMessage(LOADING_MESSAGES[idx]);
    }, 1500);
  }

  function stopLoadingMessages() {
    if (loadingIntervalRef.current) {
      clearInterval(loadingIntervalRef.current);
      loadingIntervalRef.current = null;
    }
  }

  async function handleParse() {
    if (!rawText.trim()) return;

    setIsParsing(true);
    setServerError(null);
    startLoadingMessages();

    try {
      const res = await api.post("/api/v1/jobs/parse", { text: rawText });

      if (res.ok) {
        const json = await res.json();
        const parsed: ParsedJob = json.data;

        // Pre-fill form with parsed data
        reset({
          title: parsed.job_title ?? "",
          company: parsed.company ?? "",
          location: parsed.location ?? "",
          salary: parsed.salary ?? "",
          description_raw: rawText,
          requirements: parsed.requirements ?? [],
        });
        setTags(parsed.requirements ?? []);
        setShowForm(true);
      } else {
        // MONETIZE-14: /jobs/parse no longer enforces AI quota (Phase 5.1
        // removed `require_ai_quota`), so a credit-error envelope is not
        // expected here — surface a generic message and offer Manual mode.
        setServerError(t("parseErrorToast"));
      }
    } catch {
      setServerError(tAuth("networkError"));
    } finally {
      stopLoadingMessages();
      setIsParsing(false);
    }
  }

  // ------------------------------------------------------------------
  // Form submit — create job
  // ------------------------------------------------------------------

  async function onSubmit(values: JobFormValues) {
    setServerError(null);

    const payload = {
      title: values.title,
      company: values.company,
      ...(values.location ? { location: values.location } : {}),
      ...(values.salary ? { salary: values.salary } : {}),
      ...(values.description_raw ? { description_raw: values.description_raw } : {}),
      ...(tags.length > 0 ? { requirements: tags } : {}),
    };

    try {
      const res = await api.post("/api/v1/jobs", payload);

      if (res.ok || res.status === 201) {
        router.push("/dashboard/jobs");
        return;
      }

      // MONETIZE-14 — 402 ACTIVE_JOBS_EXCEEDED dispatches to UpgradeModal via
      // the typed parser. Run it first because it consumes the response body.
      const limitErr = await parseLimitError(res);
      if (limitErr?.kind === "credit") {
        openFromCreditError(limitErr);
        return;
      }

      if (res.status === 422) {
        setServerError(t("invalidFieldsError"));
      } else {
        setServerError(tCommon("toast.genericError"));
      }
    } catch {
      setServerError(tAuth("networkError"));
    }
  }

  // ------------------------------------------------------------------
  // Tag helpers
  // ------------------------------------------------------------------

  function addTag(tag: string) {
    if (!tags.includes(tag)) {
      setTags((prev) => [...prev, tag]);
    }
  }

  function removeTag(index: number) {
    setTags((prev) => prev.filter((_, i) => i !== index));
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      {modalState && (
        <UpgradeModal
          open={modalState.open}
          onClose={closeModal}
          reason={modalState.reason}
          currentCount={modalState.currentCount}
          planLimit={modalState.planLimit}
          resetAt={modalState.resetAt}
        />
      )}
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 rounded-lg border border-input bg-muted p-1 w-fit">
        <button
          type="button"
          onClick={() => handleModeChange("ai")}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            mode === "ai"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("modeAi")}
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("manual")}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            mode === "manual"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("modeManual")}
        </button>
      </div>

      {/* Card container */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">

        {/* ---- AI Parse section ---- */}
        {mode === "ai" && !showForm && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="paste-area">{t("pasteLabel")}</Label>
              <textarea
                id="paste-area"
                rows={10}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={t("pastePlaceholder")}
                disabled={isParsing}
                className={cn(
                  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                  "placeholder:text-muted-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  "resize-y min-h-[160px]"
                )}
              />
            </div>

            {/* Server error in parse phase */}
            {serverError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            {/* Parse button */}
            <Button
              type="button"
              onClick={handleParse}
              disabled={isParsing || !rawText.trim()}
              className="w-full sm:w-auto"
            >
              {isParsing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {loadingMessage}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {t("parseButton")}
                </>
              )}
            </Button>
          </div>
        )}

        {/* ---- Review / edit form ---- */}
        {showForm && (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {/* Context strip when coming from AI parse */}
            {mode === "ai" && (
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                <span className="text-xs text-muted-foreground">{t("reviewHint")}</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setServerError(null);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
                >
                  {t("startOver")}
                </button>
              </div>
            )}

            {/* Server error on save */}
            {serverError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            {/* Row: Title + Company */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Job Title */}
              <div className="space-y-1.5">
                <Label htmlFor="title">
                  {t("titleLabel")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder={t("titlePlaceholder")}
                  {...register("title")}
                  className={cn(
                    errors.title && "border-destructive focus-visible:ring-destructive"
                  )}
                />
                {errors.title && (
                  <p className="text-xs text-destructive">{errors.title.message}</p>
                )}
              </div>

              {/* Company */}
              <div className="space-y-1.5">
                <Label htmlFor="company">
                  {t("companyLabel")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="company"
                  placeholder={t("companyPlaceholder")}
                  {...register("company")}
                  className={cn(
                    errors.company && "border-destructive focus-visible:ring-destructive"
                  )}
                />
                {errors.company && (
                  <p className="text-xs text-destructive">{errors.company.message}</p>
                )}
              </div>
            </div>

            {/* Row: Location + Salary */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Location */}
              <div className="space-y-1.5">
                <Label htmlFor="location">{t("locationLabel")}</Label>
                <Input
                  id="location"
                  placeholder={t("locationPlaceholder")}
                  {...register("location")}
                />
              </div>

              {/* Salary */}
              <div className="space-y-1.5">
                <Label htmlFor="salary">{t("salaryLabel")}</Label>
                <Input
                  id="salary"
                  placeholder={t("salaryPlaceholder")}
                  {...register("salary")}
                />
              </div>
            </div>

            {/* Job Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description_raw">{t("descriptionLabel")}</Label>
              <textarea
                id="description_raw"
                rows={4}
                placeholder={t("descriptionPlaceholder")}
                {...register("description_raw")}
                className={cn(
                  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                  "placeholder:text-muted-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  "resize-y min-h-[80px]"
                )}
              />
            </div>

            {/* Requirements */}
            <div className="space-y-1.5">
              <Label htmlFor="requirements-input">{t("requirementsLabel")}</Label>
              <RequirementsInput tags={tags} onAdd={addTag} onRemove={removeTag} />
              <p className="text-xs text-muted-foreground">{t("requirementsHint")}</p>
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Action buttons */}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link href="/dashboard/jobs">
                <Button type="button" variant="outline" className="w-full sm:w-auto">
                  {tCommon("actions.cancel")}
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {tCommon("states.saving")}
                  </>
                ) : (
                  t("confirmAndSave")
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
