"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  Star,
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
import { api } from "@/lib/api";
import {
  listResumes,
  uploadResume,
  analyzeResume,
  getAnalysisStatus,
  getResume,
  updateResume,
} from "@/lib/resume-api";
import type { ResumeListItem, ResumeResponse } from "@/types/resume";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JobOption {
  id: string;
  title: string;
  company: string;
}

type WizardStep = 1 | 2 | 3;
type ResumeSource = "base" | "existing" | "upload";

const LOADING_MESSAGES = [
  "Parsing your resume...",
  "Analyzing job match...",
  "Preparing recommendations...",
];

// ---------------------------------------------------------------------------
// Score color helper
// ---------------------------------------------------------------------------

function getScoreColor(score: number): { bg: string; text: string; ring: string } {
  if (score >= 90)
    return {
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      text: "text-emerald-700 dark:text-emerald-300",
      ring: "stroke-emerald-500",
    };
  if (score >= 70)
    return {
      bg: "bg-green-100 dark:bg-green-900/30",
      text: "text-green-700 dark:text-green-300",
      ring: "stroke-green-500",
    };
  if (score >= 40)
    return {
      bg: "bg-amber-100 dark:bg-amber-900/30",
      text: "text-amber-700 dark:text-amber-300",
      ring: "stroke-amber-500",
    };
  return {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
    ring: "stroke-red-500",
  };
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEP_LABELS: Record<WizardStep, string> = {
  1: "Select",
  2: "Analysis",
  3: "Review",
};

function StepIndicator({
  current,
  onStepClick,
}: {
  current: WizardStep;
  onStepClick: (step: WizardStep) => void;
}) {
  const steps: WizardStep[] = [1, 2, 3];
  return (
    <div className="flex items-center gap-2">
      {steps.map((step, idx) => {
        const done = step < current;
        const active = step === current;
        return (
          <div key={step} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              {done ? (
                <button
                  type="button"
                  onClick={() => onStepClick(step)}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                    "bg-primary text-primary-foreground hover:opacity-80"
                  )}
                  aria-label={`Go back to step ${step}`}
                >
                  <CheckCircle className="h-4 w-4" />
                </button>
              ) : (
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors border",
                    active
                      ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 border-primary"
                      : "bg-muted text-muted-foreground border-border"
                  )}
                >
                  {step}
                </div>
              )}
              <span
                className={cn(
                  "hidden sm:inline text-sm font-medium",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {STEP_LABELS[step]}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  "h-px w-10 transition-colors",
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
// Match score circle
// ---------------------------------------------------------------------------

function MatchScoreCircle({ score }: { score: number }) {
  const colors = getScoreColor(score);
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 88 88">
        <circle
          cx="44"
          cy="44"
          r="36"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted"
        />
        <circle
          cx="44"
          cy="44"
          r="36"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-all duration-700", colors.ring)}
        />
      </svg>
      <div className="relative flex flex-col items-center">
        <span className={cn("text-2xl font-bold", colors.text)}>{score}</span>
        <span className="text-[10px] text-muted-foreground font-medium">/ 100</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// File drop zone
// ---------------------------------------------------------------------------

interface FileDropZoneProps {
  file: File | null;
  onFile: (file: File) => void;
  onClear: () => void;
  error: string | null;
}

function FileDropZone({ file, onFile, onClear, error }: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) onFile(dropped);
    },
    [onFile]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) onFile(picked);
    e.target.value = "";
  };

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !file && inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : file
            ? "border-green-400 bg-green-50/50 dark:bg-green-900/10"
            : "border-border bg-muted/30 cursor-pointer hover:border-primary/50 hover:bg-muted/40",
          error && "border-destructive"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="sr-only"
          onChange={handleFileInput}
        />

        {file ? (
          <div className="flex flex-col items-center gap-2">
            <FileText className="h-10 w-10 text-green-600 dark:text-green-400" />
            <div>
              <p className="font-semibold text-sm">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="mt-1 inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
              Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-semibold text-sm">Drag & drop your resume here</p>
              <p className="text-xs text-muted-foreground">or click to browse</p>
            </div>
            <p className="text-[11px] text-muted-foreground">PDF or DOCX, max 10 MB</p>
          </div>
        )}
      </div>
      {error && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Select resume & job
// ---------------------------------------------------------------------------

interface Step1Props {
  // File upload mode
  file: File | null;
  onFile: (f: File) => void;
  onClearFile: () => void;
  fileError: string | null;
  // Resume source
  resumeSource: ResumeSource;
  onResumeSource: (s: ResumeSource) => void;
  selectedResumeId: string | null;
  onSelectedResumeId: (id: string) => void;
  existingResumes: ResumeListItem[];
  resumesLoading: boolean;
  baseResume: ResumeListItem | null;
  // Job
  jobId: string | null;
  onJobId: (id: string) => void;
  jobs: JobOption[];
  jobsLoading: boolean;
  onNext: () => void;
}

function Step1({
  file,
  onFile,
  onClearFile,
  fileError,
  resumeSource,
  onResumeSource,
  selectedResumeId,
  onSelectedResumeId,
  existingResumes,
  resumesLoading,
  baseResume,
  jobId,
  onJobId,
  jobs,
  jobsLoading,
  onNext,
}: Step1Props) {
  const hasExistingResumes = existingResumes.length > 0;

  // Determine whether user can proceed
  const canProceed =
    jobId !== null &&
    (resumeSource === "base" ||
      (resumeSource === "existing" && selectedResumeId !== null) ||
      (resumeSource === "upload" && file !== null));

  const validateAndNext = () => {
    if (resumeSource === "upload" && file) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "pdf" && ext !== "docx") return;
    }
    onNext();
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Choose Your Resume</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select an existing resume or upload a new file, then pick the job to tailor it for.
        </p>
      </div>

      {/* Resume source selection — only shown when user has existing resumes */}
      {!resumesLoading && hasExistingResumes && (
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">Resume Source</label>

          <div className="flex flex-col gap-2">
            {/* Option 1: Base resume */}
            {baseResume && (
              <label
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors",
                  resumeSource === "base"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                )}
              >
                <input
                  type="radio"
                  name="resumeSource"
                  value="base"
                  checked={resumeSource === "base"}
                  onChange={() => onResumeSource("base")}
                  className="accent-primary shrink-0"
                />
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{baseResume.name}</span>
                  <Star className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-label="Base resume" />
                  <span className="text-xs text-muted-foreground uppercase shrink-0">
                    {baseResume.original_file_format}
                  </span>
                </div>
              </label>
            )}

            {/* Auto-suggest text when base is selected */}
            {resumeSource === "base" && baseResume && (
              <p className="text-xs text-muted-foreground pl-1">
                Using your base resume:{" "}
                <span className="font-medium text-foreground">
                  &quot;{baseResume.name}&quot;
                </span>{" "}
                <Star className="inline h-3 w-3 text-amber-500 mb-0.5" />
              </p>
            )}

            {/* Option 2: Select from existing */}
            <label
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors",
                resumeSource === "existing"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              )}
            >
              <input
                type="radio"
                name="resumeSource"
                value="existing"
                checked={resumeSource === "existing"}
                onChange={() => onResumeSource("existing")}
                className="accent-primary shrink-0 mt-0.5"
              />
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                <span className="text-sm font-medium">Select from my resumes</span>
                {resumeSource === "existing" && (
                  <Select
                    value={selectedResumeId ?? ""}
                    onValueChange={onSelectedResumeId}
                  >
                    <SelectTrigger className="h-9 text-sm" onClick={(e) => e.stopPropagation()}>
                      <SelectValue placeholder="Choose a resume..." />
                    </SelectTrigger>
                    <SelectContent>
                      {existingResumes.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          <span className="flex items-center gap-2">
                            <span>{r.name}</span>
                            <span className="text-xs text-muted-foreground uppercase">
                              ({r.original_file_format})
                            </span>
                            {r.match_score !== null && (
                              <span className="text-xs text-muted-foreground">
                                · {r.match_score}% match
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </label>

            {/* Option 3: Upload new file */}
            <label
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors",
                resumeSource === "upload"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              )}
            >
              <input
                type="radio"
                name="resumeSource"
                value="upload"
                checked={resumeSource === "upload"}
                onChange={() => onResumeSource("upload")}
                className="accent-primary shrink-0"
              />
              <span className="text-sm font-medium">Upload new file</span>
            </label>
          </div>

          {/* Upload zone — only shown when "Upload new file" selected */}
          {resumeSource === "upload" && (
            <FileDropZone
              file={file}
              onFile={(f) => {
                const ext = f.name.split(".").pop()?.toLowerCase();
                if (ext !== "pdf" && ext !== "docx") return;
                onFile(f);
              }}
              onClear={onClearFile}
              error={fileError}
            />
          )}
        </div>
      )}

      {/* No existing resumes — show only the upload zone */}
      {!resumesLoading && !hasExistingResumes && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Upload Your Resume</label>
          <FileDropZone
            file={file}
            onFile={(f) => {
              const ext = f.name.split(".").pop()?.toLowerCase();
              if (ext !== "pdf" && ext !== "docx") return;
              onFile(f);
            }}
            onClear={onClearFile}
            error={fileError}
          />
        </div>
      )}

      {/* Loading skeleton for resumes */}
      {resumesLoading && (
        <div className="h-12 rounded-lg border border-border bg-muted/20 animate-pulse" />
      )}

      {/* Job selector */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Target Job</label>
        {jobsLoading ? (
          <div className="h-9 rounded-md border border-border bg-muted/20 animate-pulse" />
        ) : (
          <Select value={jobId ?? ""} onValueChange={onJobId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a job..." />
            </SelectTrigger>
            <SelectContent>
              {jobs.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                  No jobs found.{" "}
                  <Link href="/dashboard/jobs/new" className="underline text-primary">
                    Create one first.
                  </Link>
                </div>
              ) : (
                jobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title} at {job.company}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}
        <p className="text-xs text-muted-foreground">
          The AI will tailor your resume to match this job description.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={validateAndNext} disabled={!canProceed} className="gap-1.5">
          Analyze Resume
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Analysis (polling)
// ---------------------------------------------------------------------------

interface Step2Props {
  isAnalyzing: boolean;
  loadingMsg: string;
  analysisResume: ResumeResponse | null; // Full resume fetched after completion
  analysisError: string | null;
  onBack: () => void;
  onApplyRecommendations: () => void;
  onEditManually: () => void;
}

function Step2({
  isAnalyzing,
  loadingMsg,
  analysisResume,
  analysisError,
  onBack,
  onApplyRecommendations,
  onEditManually,
}: Step2Props) {
  const analysis = analysisResume
    ? {
        match_score: analysisResume.match_score ?? 0,
        keyword_gaps: analysisResume.ai_recommendations?.keyword_gaps ?? [],
        recommendations: analysisResume.ai_recommendations?.recommendations ?? [],
      }
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div>
          <h2 className="text-lg font-semibold">AI Analysis</h2>
          <p className="text-sm text-muted-foreground">
            Review the analysis results and recommendations.
          </p>
        </div>
      </div>

      {/* Loading state */}
      {isAnalyzing && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-muted/20 px-6 py-12">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">{loadingMsg}</p>
        </div>
      )}

      {/* Error state */}
      {analysisError && !isAnalyzing && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Analysis failed</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{analysisError}</p>
            <button
              onClick={onBack}
              className="mt-2 text-xs underline text-muted-foreground hover:text-foreground"
            >
              Go back and try again
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {analysis && !isAnalyzing && (
        <>
          {/* Match score */}
          <div className="flex flex-col sm:flex-row items-center gap-6 rounded-xl border border-border bg-card p-5">
            <MatchScoreCircle score={analysis.match_score} />
            <div>
              <p className="font-semibold">Match Score</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {analysis.match_score >= 90
                  ? "Excellent match! Your resume is very well-tailored for this role."
                  : analysis.match_score >= 70
                  ? "Good match. A few improvements could strengthen your application."
                  : analysis.match_score >= 40
                  ? "Moderate match. Optimization is recommended to improve your chances."
                  : "Your resume needs significant optimization to match this role."}
              </p>
            </div>
          </div>

          {/* Keyword gaps */}
          {analysis.keyword_gaps.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Missing Keywords</h3>
              <div className="flex flex-wrap gap-1.5">
                {analysis.keyword_gaps.map((kw) => (
                  <span
                    key={kw}
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {analysis.recommendations.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">AI Recommendations</h3>
              <ol className="flex flex-col gap-2">
                {analysis.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm text-muted-foreground">{rec}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={onApplyRecommendations} className="gap-1.5">
              <Sparkles className="h-4 w-4" />
              Apply AI Recommendations
            </Button>
            <Button variant="outline" onClick={onEditManually}>
              Edit Manually
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Review & apply
// ---------------------------------------------------------------------------

interface SectionDiffProps {
  label: string;
  original: unknown;
  optimized: unknown;
  onApply: () => void;
  applied: boolean;
}

function SectionDiff({ label, original, optimized, onApply, applied }: SectionDiffProps) {
  const changed = JSON.stringify(original) !== JSON.stringify(optimized);
  if (!changed) return null;

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-colors",
        applied
          ? "border-green-300 bg-green-50/50 dark:border-green-700 dark:bg-green-900/10"
          : "border-border"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold capitalize">{label}</p>
        <button
          onClick={onApply}
          disabled={applied}
          className={cn(
            "text-xs font-medium px-2.5 py-1 rounded-md transition-colors",
            applied
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-default"
              : "bg-primary/10 text-primary hover:bg-primary/20"
          )}
        >
          {applied ? (
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Applied
            </span>
          ) : (
            "Apply Section"
          )}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        AI has optimized this section with better keywords and phrasing.
      </p>
    </div>
  );
}

interface Step3Props {
  analysisResume: ResumeResponse;
  onBack: () => void;
  onApplyAll: () => void;
  onSkip: () => void;
  isApplying: boolean;
}

function Step3({ analysisResume, onBack, onApplyAll, onSkip, isApplying }: Step3Props) {
  const [appliedSections, setAppliedSections] = useState<Set<string>>(new Set());

  const parsedData = analysisResume.parsed_data;
  const optimizedData = analysisResume.optimized_data;

  const sections = [
    { key: "personal_info", label: "Personal Info" },
    { key: "summary", label: "Summary" },
    { key: "experience", label: "Experience" },
    { key: "education", label: "Education" },
    { key: "skills", label: "Skills" },
    { key: "languages", label: "Languages" },
    { key: "certifications", label: "Certifications" },
  ] as const;

  const changedSections = sections.filter(
    ({ key }) =>
      parsedData &&
      optimizedData &&
      JSON.stringify(parsedData[key]) !== JSON.stringify(optimizedData[key])
  );

  const applySection = (key: string) => {
    setAppliedSections((prev) => new Set([...prev, key]));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div>
          <h2 className="text-lg font-semibold">Review Optimizations</h2>
          <p className="text-sm text-muted-foreground">
            {changedSections.length} section{changedSections.length !== 1 ? "s" : ""} optimized by
            AI. Apply all or pick individual sections.
          </p>
        </div>
      </div>

      {changedSections.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/20 px-6 py-10 text-center">
          <CheckCircle className="mx-auto h-10 w-10 text-green-500" />
          <p className="mt-3 text-sm font-medium">Your resume is already well-optimized!</p>
          <p className="mt-1 text-xs text-muted-foreground">
            No significant changes were recommended.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {changedSections.map(({ key, label }) => (
            <SectionDiff
              key={key}
              label={label}
              original={parsedData?.[key]}
              optimized={optimizedData?.[key]}
              onApply={() => applySection(key)}
              applied={appliedSections.has(key)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onApplyAll} disabled={isApplying} className="gap-1.5">
          {isApplying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Applying...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Apply All &amp; Edit
            </>
          )}
        </Button>
        <Button variant="outline" onClick={onSkip} disabled={isApplying}>
          Skip &amp; Edit Original
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard page
// ---------------------------------------------------------------------------

export default function TailorResumePage() {
  const router = useRouter();

  // Wizard state
  const [step, setStep] = useState<WizardStep>(1);

  // Resume source
  const [resumeSource, setResumeSource] = useState<ResumeSource>("upload");
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [existingResumes, setExistingResumes] = useState<ResumeListItem[]>([]);
  const [resumesLoading, setResumesLoading] = useState(true);
  const [baseResume, setBaseResume] = useState<ResumeListItem | null>(null);

  // File upload
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // Job
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  // Analysis state
  const [analysisResume, setAnalysisResume] = useState<ResumeResponse | null>(null);
  const [activeResumeId, setActiveResumeId] = useState<string | null>(null); // resume being analyzed
  const [taskId, setTaskId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [isApplying, setIsApplying] = useState(false);

  // Fetch existing resumes on mount
  useEffect(() => {
    listResumes()
      .then(({ items }) => {
        setExistingResumes(items);
        const base = items.find((r) => r.is_base) ?? null;
        setBaseResume(base);
        if (base) {
          setResumeSource("base");
          setSelectedResumeId(base.id);
        } else if (items.length > 0) {
          setResumeSource("existing");
        } else {
          setResumeSource("upload");
        }
      })
      .catch(() => setExistingResumes([]))
      .finally(() => setResumesLoading(false));
  }, []);

  // Fetch jobs on mount
  useEffect(() => {
    api
      .get("/api/v1/jobs?limit=100")
      .then((r) => r.json())
      .then((data: { items: JobOption[] }) => {
        setJobs(data.items ?? []);
      })
      .catch(() => setJobs([]))
      .finally(() => setJobsLoading(false));
  }, []);

  // Cycle loading messages while analyzing
  useEffect(() => {
    if (!isAnalyzing) return;
    const interval = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // Poll for analysis status
  useEffect(() => {
    if (!taskId || !activeResumeId) return;

    const interval = setInterval(async () => {
      try {
        const status = await getAnalysisStatus(taskId);
        if (status.status === "completed") {
          clearInterval(interval);
          const resume = await getResume(activeResumeId);
          setAnalysisResume(resume);
          setIsAnalyzing(false);
          setStep(2);
        } else if (status.status === "failed") {
          clearInterval(interval);
          setAnalysisError(status.error ?? "Analysis failed. Please try again.");
          setIsAnalyzing(false);
        }
      } catch (err) {
        clearInterval(interval);
        setAnalysisError(
          err instanceof Error ? err.message : "An unexpected error occurred."
        );
        setIsAnalyzing(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [taskId, activeResumeId]);

  // Block navigation while analyzing
  useEffect(() => {
    if (!isAnalyzing) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isAnalyzing]);

  const handleFile = (f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "docx") {
      setFileError("Only PDF and DOCX files are accepted.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setFileError("File size must be under 10 MB.");
      return;
    }
    setFileError(null);
    setFile(f);
  };

  const handleResumeSourceChange = (source: ResumeSource) => {
    setResumeSource(source);
    if (source === "base" && baseResume) {
      setSelectedResumeId(baseResume.id);
    } else if (source !== "existing") {
      // Don't clear when switching to existing; user may have already picked one
    }
  };

  const handleAnalyze = async () => {
    if (!jobId) return;

    setStep(2);
    setIsAnalyzing(true);
    setAnalysisError(null);
    setLoadingMsgIdx(0);
    setAnalysisResume(null);

    try {
      let resumeId: string;

      if (resumeSource === "upload") {
        if (!file) return;
        const uploaded = await uploadResume(file, jobId);
        resumeId = uploaded.id;
      } else {
        // "base" or "existing" — use selected resume ID
        if (!selectedResumeId) return;
        resumeId = selectedResumeId;
      }

      setActiveResumeId(resumeId);

      // Kick off async analysis
      const { task_id } = await analyzeResume(resumeId, jobId);
      setTaskId(task_id);
      // Polling is handled by the useEffect above
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : "An unexpected error occurred. Please try again."
      );
      setIsAnalyzing(false);
    }
  };

  const handleApplyAll = async () => {
    if (!analysisResume) return;
    setIsApplying(true);
    try {
      await updateResume(analysisResume.id, {
        parsed_data: analysisResume.optimized_data ?? analysisResume.parsed_data ?? undefined,
      });
      router.push(`/dashboard/resumes/${analysisResume.id}`);
    } catch {
      setIsApplying(false);
    }
  };

  const handleSkipToEditor = () => {
    if (!analysisResume) return;
    router.push(`/dashboard/resumes/${analysisResume.id}`);
  };

  const handleStepClick = (s: WizardStep) => {
    // Only allow going back to completed steps
    if (s < step) setStep(s);
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex justify-end">
        <StepIndicator current={step} onStepClick={handleStepClick} />
      </div>

      {/* Wizard step content */}
      <div className="rounded-xl border border-border bg-card p-6">
        {step === 1 && (
          <Step1
            file={file}
            onFile={handleFile}
            onClearFile={() => {
              setFile(null);
              setFileError(null);
            }}
            fileError={fileError}
            resumeSource={resumeSource}
            onResumeSource={handleResumeSourceChange}
            selectedResumeId={selectedResumeId}
            onSelectedResumeId={(id) => setSelectedResumeId(id)}
            existingResumes={existingResumes}
            resumesLoading={resumesLoading}
            baseResume={baseResume}
            jobId={jobId}
            onJobId={setJobId}
            jobs={jobs}
            jobsLoading={jobsLoading}
            onNext={handleAnalyze}
          />
        )}

        {step === 2 && (
          <Step2
            isAnalyzing={isAnalyzing}
            loadingMsg={LOADING_MESSAGES[loadingMsgIdx]}
            analysisResume={analysisResume}
            analysisError={analysisError}
            onBack={() => {
              setStep(1);
              setAnalysisResume(null);
              setAnalysisError(null);
              setTaskId(null);
              setActiveResumeId(null);
            }}
            onApplyRecommendations={() => setStep(3)}
            onEditManually={handleSkipToEditor}
          />
        )}

        {step === 3 && analysisResume && (
          <Step3
            analysisResume={analysisResume}
            onBack={() => setStep(2)}
            onApplyAll={handleApplyAll}
            onSkip={handleSkipToEditor}
            isApplying={isApplying}
          />
        )}
      </div>
    </div>
  );
}
