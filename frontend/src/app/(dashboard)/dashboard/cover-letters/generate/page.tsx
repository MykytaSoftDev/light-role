"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listJobs } from "@/lib/jobs-api";
import { listResumes } from "@/lib/resume-api";
import {
  generateCoverLetter,
  regenerateCoverLetter,
} from "@/lib/cover-letter-api";
import type { CLStyle, CLTone, CLLength, CoverLetterVariant } from "@/types/cover-letter";
import type { ResumeListItem } from "@/types/resume";
import type { JobOption } from "@/lib/jobs-api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type WizardStep = 1 | 2 | 3;

const LOADING_MESSAGES = [
  "Understanding the role...",
  "Analyzing your experience...",
  "Crafting your story...",
  "Finalizing your cover letter...",
];

const STYLE_OPTIONS: { value: CLStyle; label: string; description: string }[] = [
  {
    value: "job_matched",
    label: "Job Matched",
    description: "Tailored specifically to the job requirements",
  },
  {
    value: "formal",
    label: "Formal",
    description: "Traditional, structured business language",
  },
  {
    value: "professional",
    label: "Professional",
    description: "Polished and industry-appropriate tone",
  },
];

const TONE_OPTIONS: { value: CLTone; label: string; description: string }[] = [
  {
    value: "confident",
    label: "Confident",
    description: "Strong and assertive voice",
  },
  {
    value: "humble",
    label: "Humble",
    description: "Modest and collaborative tone",
  },
  {
    value: "enthusiastic",
    label: "Enthusiastic",
    description: "Energetic and passionate approach",
  },
];

const LENGTH_OPTIONS: { value: CLLength; label: string; range: string }[] = [
  { value: "short", label: "Short", range: "200–300 words" },
  { value: "medium", label: "Medium", range: "300–400 words" },
  { value: "long", label: "Long", range: "400–500 words" },
];

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ current, total }: { current: WizardStep; total: number }) {
  const labels = ["Select Job & Resume", "Generation Settings", "Review Variants"];
  return (
    <div className="flex items-center gap-0">
      {Array.from({ length: total }, (_, i) => {
        const step = (i + 1) as WizardStep;
        const isCompleted = step < current;
        const isActive = step === current;
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                  isCompleted
                    ? "bg-primary text-primary-foreground"
                    : isActive
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? <CheckCircle className="h-4 w-4" /> : step}
              </div>
              <span
                className={cn(
                  "mt-1 text-[10px] font-medium whitespace-nowrap",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {labels[i]}
              </span>
            </div>
            {i < total - 1 && (
              <div
                className={cn(
                  "mx-2 mb-4 h-px w-12 sm:w-20 transition-colors",
                  step < current ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Option button (for style/tone/length pickers)
// ---------------------------------------------------------------------------

interface OptionButtonProps {
  selected: boolean;
  onClick: () => void;
  label: string;
  sublabel: string;
}

function OptionButton({ selected, onClick, label, sublabel }: OptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start rounded-lg border p-3 text-left transition-colors w-full",
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
      )}
    >
      <span
        className={cn(
          "text-sm font-semibold",
          selected ? "text-primary" : "text-foreground"
        )}
      >
        {label}
      </span>
      <span className="mt-0.5 text-xs text-muted-foreground">{sublabel}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Variant display set
// ---------------------------------------------------------------------------

interface VariantSet {
  setId: string;
  variants: CoverLetterVariant[];
}

interface VariantSetsDisplayProps {
  variantSets: VariantSet[];
  selectedVariantSetIdx: number;
  selectedVariantIdx: number;
  onSelectVariantSet: (setIdx: number) => void;
  onSelectVariant: (setIdx: number, varIdx: number) => void;
  onUseVariant: (setIdx: number, varIdx: number) => void;
}

function VariantSetsDisplay({
  variantSets,
  selectedVariantSetIdx,
  selectedVariantIdx,
  onSelectVariantSet,
  onSelectVariant,
  onUseVariant,
}: VariantSetsDisplayProps) {
  const activeSet = variantSets[selectedVariantSetIdx];

  return (
    <div className="flex flex-col gap-4">
      {/* Set selector — show if more than one generation */}
      {variantSets.length > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground font-medium">Generation:</span>
          <div className="flex gap-1.5">
            {variantSets.map((_, idx) => (
              <button
                key={idx}
                onClick={() => onSelectVariantSet(idx)}
                className={cn(
                  "px-3 py-1 rounded-full border text-xs font-medium transition-colors",
                  idx === selectedVariantSetIdx
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                )}
              >
                #{idx + 1}
                {idx === variantSets.length - 1 && (
                  <span className="ml-1 text-[10px] opacity-70">latest</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Variant tabs within the selected set */}
      {activeSet && (
        <>
          <div className="flex gap-2 flex-wrap">
            {activeSet.variants.map((variant, idx) => (
              <button
                key={idx}
                onClick={() => onSelectVariant(selectedVariantSetIdx, idx)}
                className={cn(
                  "px-4 py-1.5 rounded-full border text-sm font-medium transition-colors",
                  idx === selectedVariantIdx
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                )}
              >
                {variant.label || `Variant ${idx + 1}`}
              </button>
            ))}
          </div>

          {/* Selected variant content */}
          {activeSet.variants[selectedVariantIdx] && (
            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border">
                <span className="text-sm font-semibold text-foreground">
                  {activeSet.variants[selectedVariantIdx].label ||
                    `Variant ${selectedVariantIdx + 1}`}
                </span>
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs gap-1.5"
                  onClick={() =>
                    onUseVariant(selectedVariantSetIdx, selectedVariantIdx)
                  }
                >
                  <CheckCircle className="h-3 w-3" />
                  Use This Variant
                </Button>
              </div>
              <div className="max-h-80 overflow-y-auto px-4 py-3">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {activeSet.variants[selectedVariantIdx].content}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard page
// ---------------------------------------------------------------------------

export default function GenerateCoverLetterPage() {
  const router = useRouter();

  // Step state
  const [step, setStep] = useState<WizardStep>(1);

  // Step 1 state
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [additionalContext, setAdditionalContext] = useState<string>("");
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  // Step 2 state
  const [style, setStyle] = useState<CLStyle>("job_matched");
  const [tone, setTone] = useState<CLTone>("confident");
  const [length, setLength] = useState<CLLength>("medium");

  // Step 3 state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [loadingMessageIdx, setLoadingMessageIdx] = useState(0);
  const [coverLetterId, setCoverLetterId] = useState<string | null>(null);
  const [variantSets, setVariantSets] = useState<VariantSet[]>([]);
  const [selectedVariantSetIdx, setSelectedVariantSetIdx] = useState(0);
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load jobs and resumes on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingOptions(true);
    setOptionsError(null);

    Promise.all([listJobs(), listResumes()])
      .then(([jobsData, resumesData]) => {
        if (!cancelled) {
          setJobs(jobsData.items);
          setResumes(resumesData.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOptionsError("Failed to load jobs and resumes. Please refresh the page.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Cycle loading messages while generating
  useEffect(() => {
    if (isGenerating) {
      setLoadingMessageIdx(0);
      loadingIntervalRef.current = setInterval(() => {
        setLoadingMessageIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 1500);
    } else {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }
    }
    return () => {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    };
  }, [isGenerating]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerateError(null);

    try {
      const result = await generateCoverLetter({
        job_id: selectedJobId,
        resume_id: selectedResumeId,
        style,
        tone,
        length,
        additional_context: additionalContext,
      });

      const newSet: VariantSet = {
        setId: `set-${Date.now()}`,
        variants: result.variants,
      };

      setCoverLetterId(result.cover_letter_id);
      setVariantSets([newSet]);
      setSelectedVariantSetIdx(0);
      setSelectedVariantIdx(0);
      setStep(3);
    } catch {
      setGenerateError("Failed to generate cover letter. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    if (!coverLetterId) return;
    setIsGenerating(true);
    setGenerateError(null);

    try {
      const result = await regenerateCoverLetter(coverLetterId, {
        style,
        tone,
        length,
        additional_context: additionalContext,
      });

      const newSet: VariantSet = {
        setId: `set-${Date.now()}`,
        variants: result.variants,
      };

      setVariantSets((prev) => [...prev, newSet]);
      setSelectedVariantSetIdx(variantSets.length); // point to the new set
      setSelectedVariantIdx(0);
    } catch {
      setGenerateError("Failed to regenerate cover letter. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseVariant = (_setIdx: number, _varIdx: number) => {
    if (!coverLetterId) return;
    router.push(`/dashboard/cover-letters/${coverLetterId}`);
  };

  // Sorted resumes: show resumes for the selected job first, then others
  const sortedResumes =
    selectedJobId
      ? [
          ...resumes.filter((r) => r.job_id === selectedJobId),
          ...resumes.filter((r) => r.job_id !== selectedJobId),
        ]
      : resumes;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">
      {/* Back link */}
      <Link
        href="/dashboard/cover-letters"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Cover Letters
      </Link>

      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Generate Cover Letter</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AI-powered cover letter generation tailored to the job.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex justify-center">
        <StepIndicator current={step} total={3} />
      </div>

      {/* Step 1: Select Job & Resume */}
      {step === 1 && (
        <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-5">
          <h2 className="font-semibold text-base">Select Job & Resume</h2>

          {loadingOptions ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : optionsError ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {optionsError}
            </div>
          ) : (
            <>
              {/* Job selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Job <span className="text-destructive">*</span>
                </label>
                {jobs.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                    You need to create a job first.{" "}
                    <Link
                      href="/dashboard/jobs/new"
                      className="font-semibold underline underline-offset-2"
                    >
                      Go to Jobs
                    </Link>
                  </div>
                ) : (
                  <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a job..." />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.title}
                          {job.company ? ` — ${job.company}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Resume selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Resume <span className="text-destructive">*</span>
                </label>
                {resumes.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                    You need to upload a resume first.{" "}
                    <Link
                      href="/dashboard/resumes/tailor"
                      className="font-semibold underline underline-offset-2"
                    >
                      Go to Resumes
                    </Link>
                  </div>
                ) : (
                  <Select value={selectedResumeId} onValueChange={setSelectedResumeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a resume..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedResumes.map((resume) => (
                        <SelectItem key={resume.id} value={resume.id}>
                          {resume.name}
                          {resume.job_id === selectedJobId && selectedJobId
                            ? " (for this job)"
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Additional context */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Additional Context{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder="Any specific points you'd like to highlight, personal connection to the company, etc."
                  rows={4}
                  className={cn(
                    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                    "placeholder:text-muted-foreground",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    "resize-none"
                  )}
                />
              </div>
            </>
          )}

          {/* Navigation */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={() => setStep(2)}
              disabled={!selectedJobId || !selectedResumeId || loadingOptions}
              className="gap-1.5"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Generation Settings */}
      {step === 2 && (
        <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-6">
          <h2 className="font-semibold text-base">Generation Settings</h2>

          {/* Style */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">Style</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {STYLE_OPTIONS.map((opt) => (
                <OptionButton
                  key={opt.value}
                  selected={style === opt.value}
                  onClick={() => setStyle(opt.value)}
                  label={opt.label}
                  sublabel={opt.description}
                />
              ))}
            </div>
          </div>

          {/* Tone */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">Tone</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {TONE_OPTIONS.map((opt) => (
                <OptionButton
                  key={opt.value}
                  selected={tone === opt.value}
                  onClick={() => setTone(opt.value)}
                  label={opt.label}
                  sublabel={opt.description}
                />
              ))}
            </div>
          </div>

          {/* Length */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">Length</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {LENGTH_OPTIONS.map((opt) => (
                <OptionButton
                  key={opt.value}
                  selected={length === opt.value}
                  onClick={() => setLength(opt.value)}
                  label={opt.label}
                  sublabel={opt.range}
                />
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(1)} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="gap-1.5"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Review Variants */}
      {step === 3 && (
        <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">Review Variants</h2>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-7 px-3"
              onClick={handleRegenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3" />
                  Regenerate
                </>
              )}
            </Button>
          </div>

          {/* Loading state */}
          {isGenerating && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary animate-pulse" />
              </div>
              <p className="text-sm font-medium text-foreground transition-all">
                {LOADING_MESSAGES[loadingMessageIdx]}
              </p>
              <div className="flex gap-1">
                {LOADING_MESSAGES.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-colors",
                      i === loadingMessageIdx ? "bg-primary" : "bg-muted"
                    )}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Error state */}
          {generateError && !isGenerating && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {generateError}
            </div>
          )}

          {/* Variants display */}
          {!isGenerating && variantSets.length > 0 && (
            <VariantSetsDisplay
              variantSets={variantSets}
              selectedVariantSetIdx={selectedVariantSetIdx}
              selectedVariantIdx={selectedVariantIdx}
              onSelectVariantSet={(setIdx) => {
                setSelectedVariantSetIdx(setIdx);
                setSelectedVariantIdx(0);
              }}
              onSelectVariant={(_setIdx, varIdx) => setSelectedVariantIdx(varIdx)}
              onUseVariant={handleUseVariant}
            />
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-2 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setStep(2)}
              className="gap-1.5"
              disabled={isGenerating}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Settings
            </Button>
            {coverLetterId && !isGenerating && (
              <Button
                onClick={() => router.push(`/dashboard/cover-letters/${coverLetterId}`)}
                className="gap-1.5"
              >
                Edit Selected
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
