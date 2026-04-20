"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import {
  ArrowLeft,
  GripVertical,
  Plus,
  Trash2,
  Download,
  ChevronDown,
  AlertCircle,
  Loader2,
  Check,
  X,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TemplateSelector } from "@/components/resumes/template-selector";
import type { TemplateId } from "@/lib/resume-templates/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BlobProvider, pdf } from "@react-pdf/renderer";
import { getResume, updateResume, exportResume } from "@/lib/resume-api";
import { getTemplate } from "@/lib/resume-templates/registry";
import type {
  ResumeData,
  PersonalInfo,
  ExperienceItem,
  EducationItem,
  CertificationItem,
} from "@/types/resume";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SECTIONS_ORDER = [
  "personal_info",
  "summary",
  "experience",
  "education",
  "skills",
  "languages",
  "certifications",
];

const SECTION_LABELS: Record<string, string> = {
  personal_info: "Personal Info",
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  languages: "Languages",
  certifications: "Certifications",
};

function getScoreColor(score: number | null): string {
  if (score === null) return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  if (score >= 90) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  if (score >= 70) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
  if (score >= 40) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
}

// ---------------------------------------------------------------------------
// Link label helper (Bug #7)
// ---------------------------------------------------------------------------

function getLinkLabel(url: string | null): { label: string; url: string } | null {
  if (!url) return null;
  const clean = url.replace(/^https?:\/\/(www\.)?/, "");
  if (clean.startsWith("linkedin.com")) return { label: "LinkedIn", url };
  if (clean.startsWith("github.com")) return { label: "GitHub", url };
  if (clean.startsWith("behance.net")) return { label: "Behance", url };
  if (clean.startsWith("dribbble.com")) return { label: "Dribbble", url };
  return { label: "Portfolio", url };
}

const emptyPersonalInfo: PersonalInfo = {
  name: null,
  email: null,
  phone: null,
  location: null,
  linkedin: null,
  website: null,
  summary: null,
};

const emptyResumeData: ResumeData = {
  personal_info: emptyPersonalInfo,
  summary: null,
  experience: [],
  education: [],
  skills: [],
  languages: [],
  certifications: [],
};

// ---------------------------------------------------------------------------
// Save status indicator
// ---------------------------------------------------------------------------

type SaveStatus = "idle" | "saving" | "saved" | "error";

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        status === "saving" && "text-muted-foreground",
        status === "saved" && "text-green-600 dark:text-green-400",
        status === "error" && "text-destructive"
      )}
    >
      {status === "saving" && <Loader2 className="h-3 w-3 animate-spin" />}
      {status === "saved" && <Check className="h-3 w-3" />}
      {status === "error" && <AlertCircle className="h-3 w-3" />}
      {status === "saving" && "Saving..."}
      {status === "saved" && "Saved"}
      {status === "error" && "Save failed"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Collapsible accordion section
// ---------------------------------------------------------------------------

interface SectionPanelProps {
  sectionKey: string;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  children: React.ReactNode;
}

function SectionPanel({ sectionKey, dragHandleProps, children }: SectionPanelProps) {
  const [open, setOpen] = useState(true);
  const label = SECTION_LABELS[sectionKey] ?? sectionKey;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 bg-muted/30 px-3 py-2.5">
        {/* Drag handle */}
        <div
          {...dragHandleProps}
          className="cursor-grab text-muted-foreground/50 hover:text-muted-foreground transition-colors touch-none shrink-0"
          aria-label={`Drag ${label} section`}
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Label */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center justify-between text-sm font-semibold hover:text-foreground transition-colors"
        >
          {label}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0",
              open && "rotate-180"
            )}
          />
        </button>
      </div>

      {/* Content */}
      {open && <div className="px-4 py-4">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field components
// ---------------------------------------------------------------------------

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 text-sm"
      />
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <Label className="text-xs">{label}</Label>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tag input (for skills / languages)
// ---------------------------------------------------------------------------

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (t: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
  };

  const removeTag = (idx: number) => {
    onChange(tags.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(idx)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder ?? "Add item..."}
          className="h-8 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 px-3 text-xs shrink-0"
          onClick={addTag}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Experience list editor
// ---------------------------------------------------------------------------

function ExperienceEditor({
  items,
  onChange,
}: {
  items: ExperienceItem[];
  onChange: (items: ExperienceItem[]) => void;
}) {
  const add = () =>
    onChange([
      ...items,
      {
        company: "",
        title: "",
        start_date: null,
        end_date: null,
        current: false,
        description: "",
        achievements: [],
      },
    ]);

  const update = (idx: number, patch: Partial<ExperienceItem>) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  const addAchievement = (idx: number) =>
    update(idx, { achievements: [...(items[idx].achievements ?? []), ""] });

  const updateAchievement = (idx: number, aIdx: number, val: string) =>
    update(idx, {
      achievements: items[idx].achievements.map((a, i) => (i === aIdx ? val : a)),
    });

  const removeAchievement = (idx: number, aIdx: number) =>
    update(idx, { achievements: items[idx].achievements.filter((_, i) => i !== aIdx) });

  return (
    <div className="flex flex-col gap-4">
      {items.map((item, idx) => (
        <div key={idx} className="rounded-lg border border-border p-4 relative">
          <button
            type="button"
            onClick={() => remove(idx)}
            className="absolute right-3 top-3 text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Remove experience"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          <div className="flex flex-col gap-3">
            <FieldRow>
              <FormField label="Company" value={item.company} onChange={(v) => update(idx, { company: v })} placeholder="Acme Corp" />
              <FormField label="Job Title" value={item.title} onChange={(v) => update(idx, { title: v })} placeholder="Software Engineer" />
            </FieldRow>
            <FieldRow>
              <FormField label="Start Date" value={item.start_date ?? ""} onChange={(v) => update(idx, { start_date: v || null })} placeholder="Jan 2022" />
              <FormField label="End Date" value={item.end_date ?? ""} onChange={(v) => update(idx, { end_date: v || null })} placeholder="Dec 2023" />
            </FieldRow>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={item.current}
                onChange={(e) => update(idx, { current: e.target.checked, end_date: e.target.checked ? null : item.end_date })}
                className="rounded"
              />
              Currently working here
            </label>
            <TextareaField
              label="Description"
              value={item.description}
              onChange={(v) => update(idx, { description: v })}
              placeholder="Describe your role and responsibilities..."
            />
            {/* Achievements */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs">Achievements</Label>
              {(item.achievements ?? []).map((ach, aIdx) => (
                <div key={aIdx} className="flex gap-2 items-center">
                  <Input
                    value={ach}
                    onChange={(e) => updateAchievement(idx, aIdx, e.target.value)}
                    placeholder="Reduced build time by 40%..."
                    className="h-8 text-sm flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeAchievement(idx, aIdx)}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    aria-label="Remove achievement"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-3 text-xs gap-1.5 self-start"
                onClick={() => addAchievement(idx)}
              >
                <Plus className="h-3 w-3" />
                Add Achievement
              </Button>
            </div>
          </div>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 self-start"
        onClick={add}
      >
        <Plus className="h-3.5 w-3.5" />
        Add Experience
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Education list editor
// ---------------------------------------------------------------------------

function EducationEditor({
  items,
  onChange,
}: {
  items: EducationItem[];
  onChange: (items: EducationItem[]) => void;
}) {
  const add = () =>
    onChange([
      ...items,
      { institution: "", degree: "", field: null, start_date: null, end_date: null, gpa: null },
    ]);

  const update = (idx: number, patch: Partial<EducationItem>) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  return (
    <div className="flex flex-col gap-4">
      {items.map((item, idx) => (
        <div key={idx} className="rounded-lg border border-border p-4 relative">
          <button
            type="button"
            onClick={() => remove(idx)}
            className="absolute right-3 top-3 text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Remove education"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <div className="flex flex-col gap-3">
            <FieldRow>
              <FormField label="Institution" value={item.institution} onChange={(v) => update(idx, { institution: v })} placeholder="MIT" />
              <FormField label="Degree" value={item.degree} onChange={(v) => update(idx, { degree: v })} placeholder="Bachelor of Science" />
            </FieldRow>
            <FieldRow>
              <FormField label="Field of Study" value={item.field ?? ""} onChange={(v) => update(idx, { field: v || null })} placeholder="Computer Science" />
              <FormField label="GPA" value={item.gpa ?? ""} onChange={(v) => update(idx, { gpa: v || null })} placeholder="3.8" />
            </FieldRow>
            <FieldRow>
              <FormField label="Start Date" value={item.start_date ?? ""} onChange={(v) => update(idx, { start_date: v || null })} placeholder="Sep 2018" />
              <FormField label="End Date" value={item.end_date ?? ""} onChange={(v) => update(idx, { end_date: v || null })} placeholder="May 2022" />
            </FieldRow>
          </div>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 self-start"
        onClick={add}
      >
        <Plus className="h-3.5 w-3.5" />
        Add Education
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Certifications list editor
// ---------------------------------------------------------------------------

function CertificationEditor({
  items,
  onChange,
}: {
  items: CertificationItem[];
  onChange: (items: CertificationItem[]) => void;
}) {
  const add = () => onChange([...items, { name: "", issuer: null, date: null }]);
  const update = (idx: number, patch: Partial<CertificationItem>) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  return (
    <div className="flex flex-col gap-4">
      {items.map((item, idx) => (
        <div key={idx} className="rounded-lg border border-border p-4 relative">
          <button
            type="button"
            onClick={() => remove(idx)}
            className="absolute right-3 top-3 text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Remove certification"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <div className="flex flex-col gap-3">
            <FormField label="Certification Name" value={item.name} onChange={(v) => update(idx, { name: v })} placeholder="AWS Solutions Architect" />
            <FieldRow>
              <FormField label="Issuer" value={item.issuer ?? ""} onChange={(v) => update(idx, { issuer: v || null })} placeholder="Amazon Web Services" />
              <FormField label="Date" value={item.date ?? ""} onChange={(v) => update(idx, { date: v || null })} placeholder="Jun 2023" />
            </FieldRow>
          </div>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 self-start"
        onClick={add}
      >
        <Plus className="h-3.5 w-3.5" />
        Add Certification
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// react-pdf resume preview (WYSIWYG — same renderer as PDF export)
// ---------------------------------------------------------------------------

function ResumePreviewPdf({
  data,
  sectionsOrder,
  name,
  templateId,
}: {
  data: ResumeData;
  sectionsOrder: string[];
  name: string;
  templateId: string;
}) {
  const { Component } = getTemplate(templateId);
  return (
    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-auto min-h-[600px]">
      <BlobProvider document={<Component data={data} sectionsOrder={sectionsOrder} name={name} />}>
        {({ url, loading, error }) => {
          if (loading) {
            return (
              <div className="flex items-center justify-center h-full min-h-[600px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            );
          }
          if (error || !url) {
            return (
              <div className="flex items-center justify-center h-full min-h-[600px]">
                <p className="text-sm text-muted-foreground">Preview unavailable</p>
              </div>
            );
          }
          return (
            <iframe
              src={url}
              className="w-full bg-white"
              style={{ minHeight: "880px", height: "100%", border: "none" }}
              title="Resume preview"
            />
          );
        }}
      </BlobProvider>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Classic resume HTML preview — kept as reference fallback (replaced by ResumePreviewPdf above)
// ---------------------------------------------------------------------------

function ResumePreview({
  data,
  sectionsOrder,
  name,
}: {
  data: ResumeData;
  sectionsOrder: string[];
  name: string;
}) {
  const info = data.personal_info;

  const linkedinLink = getLinkLabel(info.linkedin);
  const websiteLink = getLinkLabel(info.website);

  // Build the plain-text contact parts (email, phone, location)
  const basicContactParts = [info.email, info.phone, info.location].filter(Boolean);

  function renderSection(key: string) {
    switch (key) {
      case "personal_info":
        return (
          <div className="text-center border-b border-gray-300 pb-3 mb-3">
            <h1 className="text-xl font-bold text-gray-900">{info.name || name || "Your Name"}</h1>
            {(basicContactParts.length > 0 || linkedinLink || websiteLink) && (
              <p className="mt-1 text-[11px] text-gray-600 leading-relaxed">
                {basicContactParts.join(" · ")}
                {linkedinLink && (
                  <>
                    {basicContactParts.length > 0 ? " · " : ""}
                    <a
                      href={linkedinLink.url}
                      className="text-blue-600 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      LinkedIn
                    </a>
                  </>
                )}
                {websiteLink && (
                  <>
                    {" · "}
                    <a
                      href={websiteLink.url}
                      className="text-blue-600 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {websiteLink.label}
                    </a>
                  </>
                )}
              </p>
            )}
          </div>
        );

      case "summary":
        if (!data.summary) return null;
        return (
          <div className="mb-3">
            <h2 className="text-[12px] font-bold uppercase tracking-widest text-gray-800 border-b border-gray-200 pb-1 mb-1.5">
              Summary
            </h2>
            <p className="text-[11px] text-gray-700 italic leading-relaxed">{data.summary}</p>
          </div>
        );

      case "experience":
        if (!data.experience.length) return null;
        return (
          <div className="mb-3">
            <h2 className="text-[12px] font-bold uppercase tracking-widest text-gray-800 border-b border-gray-200 pb-1 mb-2">
              Experience
            </h2>
            <div className="flex flex-col gap-2.5">
              {data.experience.map((exp, i) => (
                <div key={i}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[11px] font-bold text-gray-900">
                      {exp.title}{exp.company ? ` — ${exp.company}` : ""}
                    </p>
                    <p className="text-[10px] text-gray-500 shrink-0">
                      {[exp.start_date, exp.current ? "Present" : exp.end_date]
                        .filter(Boolean)
                        .join(" – ")}
                    </p>
                  </div>
                  {exp.description && (
                    <p className="mt-0.5 text-[10px] text-gray-600 leading-relaxed">{exp.description}</p>
                  )}
                  {(exp.achievements ?? []).length > 0 && (
                    <ul className="mt-1 list-disc list-inside space-y-0.5">
                      {exp.achievements.map((ach, j) => (
                        <li key={j} className="text-[10px] text-gray-600">{ach}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case "education":
        if (!data.education.length) return null;
        return (
          <div className="mb-3">
            <h2 className="text-[12px] font-bold uppercase tracking-widest text-gray-800 border-b border-gray-200 pb-1 mb-2">
              Education
            </h2>
            <div className="flex flex-col gap-2">
              {data.education.map((edu, i) => (
                <div key={i}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[11px] font-bold text-gray-900">{edu.institution}</p>
                    <p className="text-[10px] text-gray-500 shrink-0">
                      {[edu.start_date, edu.end_date].filter(Boolean).join(" – ")}
                    </p>
                  </div>
                  <p className="text-[10px] text-gray-600">
                    {[edu.degree, edu.field].filter(Boolean).join(", ")}
                    {edu.gpa ? ` · GPA: ${edu.gpa}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );

      case "skills":
        if (!data.skills.length) return null;
        return (
          <div className="mb-3">
            <h2 className="text-[12px] font-bold uppercase tracking-widest text-gray-800 border-b border-gray-200 pb-1 mb-1.5">
              Skills
            </h2>
            <p className="text-[10px] text-gray-700 leading-relaxed">{data.skills.join(", ")}</p>
          </div>
        );

      case "languages":
        if (!data.languages.length) return null;
        return (
          <div className="mb-3">
            <h2 className="text-[12px] font-bold uppercase tracking-widest text-gray-800 border-b border-gray-200 pb-1 mb-1.5">
              Languages
            </h2>
            <p className="text-[10px] text-gray-700 leading-relaxed">{data.languages.join(", ")}</p>
          </div>
        );

      case "certifications":
        if (!data.certifications.length) return null;
        return (
          <div className="mb-3">
            <h2 className="text-[12px] font-bold uppercase tracking-widest text-gray-800 border-b border-gray-200 pb-1 mb-2">
              Certifications
            </h2>
            <div className="flex flex-col gap-1">
              {data.certifications.map((cert, i) => (
                <div key={i} className="flex items-baseline justify-between gap-2">
                  <p className="text-[10px] font-medium text-gray-800">{cert.name}</p>
                  <p className="text-[10px] text-gray-500 shrink-0">
                    {[cert.issuer, cert.date].filter(Boolean).join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  const orderedSections = [
    ...sectionsOrder,
    ...DEFAULT_SECTIONS_ORDER.filter((s) => !sectionsOrder.includes(s)),
  ];

  return (
    // Paper-like white card on a gray background — no disclaimer bar (Bug #5)
    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-auto h-full min-h-[600px]">
      <div
        className="bg-white shadow-md mx-auto my-4 px-8 py-6"
        style={{ width: "100%", maxWidth: "680px", minHeight: "880px" }}
      >
        {orderedSections.map((key) => (
          <div key={key}>{renderSection(key)}</div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline name editor
// ---------------------------------------------------------------------------

function InlineNameEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    onChange(draft.trim() || value);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setDraft(value); setEditing(false); }
          }}
          onBlur={commit}
          className="text-base font-semibold bg-transparent border-b border-primary outline-none px-0.5 w-64"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(value); setEditing(true); }}
      className="flex items-center gap-1.5 text-base font-semibold hover:text-primary transition-colors group"
    >
      {value}
      <Pencil className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60 transition-opacity" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main editor page
// ---------------------------------------------------------------------------

export default function ResumeEditorPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();

  // Fetch resume
  const { data: resume, isLoading, isError } = useQuery({
    queryKey: ["resume", id],
    queryFn: () => getResume(id),
  });

  // Local state (initialized from fetched data)
  const [resumeName, setResumeName] = useState("");
  const [data, setData] = useState<ResumeData>(emptyResumeData);
  const [sectionsOrder, setSectionsOrder] = useState<string[]>(DEFAULT_SECTIONS_ORDER);
  const [template, setTemplate] = useState("classic");
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isExporting, setIsExporting] = useState(false);

  // Initialize local state once data is fetched
  const initialized = useRef(false);
  useEffect(() => {
    if (resume && !initialized.current) {
      initialized.current = true;
      setResumeName(resume.name);
      setData(resume.parsed_data ?? emptyResumeData);
      setSectionsOrder(
        resume.sections_order?.length ? resume.sections_order : DEFAULT_SECTIONS_ORDER
      );
      setTemplate(resume.template ?? "classic");
    }
  }, [resume]);

  // Auto-save mutation
  const saveMutation = useMutation({
    mutationFn: () =>
      updateResume(id, {
        name: resumeName,
        parsed_data: data,
        sections_order: sectionsOrder,
        template,
      }),
    onMutate: () => setSaveStatus("saving"),
    onSuccess: () => {
      setSaveStatus("saved");
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
    onError: () => setSaveStatus("error"),
  });

  // Debounced auto-save (1500ms)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveMutation.mutate(), 1500);
  }, [saveMutation]);

  // Trigger save on any data change
  useEffect(() => {
    if (!initialized.current) return;
    triggerSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, sectionsOrder, resumeName, template]);

  // Section drag & drop
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const next = Array.from(sectionsOrder);
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    setSectionsOrder(next);
  };

  // Update helpers
  const updatePersonalInfo = (patch: Partial<PersonalInfo>) =>
    setData((d) => ({ ...d, personal_info: { ...d.personal_info, ...patch } }));

  // Export handler — PDF is generated client-side via react-pdf (WYSIWYG),
  // DOCX still goes through the backend endpoint.
  const handleExport = async (format: "pdf" | "docx") => {
    setIsExporting(true);
    try {
      if (format === "pdf") {
        const { Component } = getTemplate(template as TemplateId);
        const blob = await pdf(
          <Component data={data} sectionsOrder={sectionsOrder} name={resumeName} />
        ).toBlob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${resumeName || "resume"}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await exportResume(id, format);
      }
    } finally {
      setIsExporting(false);
    }
  };

  // Section content renderer (for the editor column)
  function renderSectionEditor(key: string) {
    switch (key) {
      case "personal_info": {
        const pi = data.personal_info;
        return (
          <div className="flex flex-col gap-3">
            <FieldRow>
              <FormField label="Full Name" value={pi.name ?? ""} onChange={(v) => updatePersonalInfo({ name: v || null })} placeholder="Jane Smith" />
              <FormField label="Email" value={pi.email ?? ""} onChange={(v) => updatePersonalInfo({ email: v || null })} placeholder="jane@example.com" type="email" />
            </FieldRow>
            <FieldRow>
              <FormField label="Phone" value={pi.phone ?? ""} onChange={(v) => updatePersonalInfo({ phone: v || null })} placeholder="+1 (555) 000-0000" />
              <FormField label="Location" value={pi.location ?? ""} onChange={(v) => updatePersonalInfo({ location: v || null })} placeholder="New York, NY" />
            </FieldRow>
            <FieldRow>
              <FormField label="LinkedIn URL" value={pi.linkedin ?? ""} onChange={(v) => updatePersonalInfo({ linkedin: v || null })} placeholder="linkedin.com/in/jane" />
              <FormField label="Website" value={pi.website ?? ""} onChange={(v) => updatePersonalInfo({ website: v || null })} placeholder="janesmith.dev" />
            </FieldRow>
          </div>
        );
      }

      case "summary":
        return (
          <TextareaField
            value={data.summary ?? ""}
            onChange={(v) => setData((d) => ({ ...d, summary: v || null }))}
            placeholder="A brief professional summary..."
            rows={4}
          />
        );

      case "experience":
        return (
          <ExperienceEditor
            items={data.experience}
            onChange={(items) => setData((d) => ({ ...d, experience: items }))}
          />
        );

      case "education":
        return (
          <EducationEditor
            items={data.education}
            onChange={(items) => setData((d) => ({ ...d, education: items }))}
          />
        );

      case "skills":
        return (
          <TagInput
            tags={data.skills}
            onChange={(tags) => setData((d) => ({ ...d, skills: tags }))}
            placeholder="Add a skill..."
          />
        );

      case "languages":
        return (
          <TagInput
            tags={data.languages}
            onChange={(tags) => setData((d) => ({ ...d, languages: tags }))}
            placeholder="Add a language..."
          />
        );

      case "certifications":
        return (
          <CertificationEditor
            items={data.certifications}
            onChange={(items) => setData((d) => ({ ...d, certifications: items }))}
          />
        );

      default:
        return null;
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !resume) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-6">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">Failed to load resume.</p>
        <Button asChild variant="outline">
          <Link href="/dashboard/resumes">Back to Resumes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5 shrink-0 flex-wrap">
        <Link
          href="/dashboard/resumes"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Resumes</span>
        </Link>

        <div className="h-4 w-px bg-border hidden sm:block" />

        <InlineNameEditor value={resumeName} onChange={setResumeName} />

        <div className="flex-1" />

        {/* Template selector */}
        <TemplateSelector
          value={template as TemplateId}
          onChange={(id) => setTemplate(id)}
          disabled={isExporting}
        />

        {/* Match score badge (Bug #8: consistent score color scale) */}
        {resume.match_score !== null && (
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0",
              getScoreColor(resume.match_score)
            )}
          >
            {resume.match_score}% match
          </span>
        )}

        {/* Save status */}
        <SaveIndicator status={saveStatus} />

        {/* Export dropdown (Bug #6: PDF + DOCX options) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs gap-1.5 shrink-0"
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Export
              <ChevronDown className="h-3 w-3 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport("pdf")}>
              Download PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("docx")}>
              Download DOCX
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile tab switcher */}
      <div className="lg:hidden flex border-b border-border shrink-0">
        {(["edit", "preview"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={cn(
              "flex-1 py-2 text-sm font-medium capitalize transition-colors",
              mobileTab === tab
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor column */}
        <div
          className={cn(
            "flex flex-col gap-0 overflow-y-auto p-4",
            "lg:w-1/2 lg:block",
            mobileTab === "edit" ? "flex-1" : "hidden lg:flex lg:flex-1"
          )}
        >
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="sections">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="flex flex-col gap-3"
                >
                  {sectionsOrder.map((key, index) => (
                    <Draggable key={key} draggableId={key} index={index}>
                      {(drag, snapshot) => (
                        <div
                          ref={drag.innerRef}
                          {...drag.draggableProps}
                          className={cn(
                            snapshot.isDragging && "opacity-80 shadow-lg ring-2 ring-primary/30"
                          )}
                        >
                          <SectionPanel
                            sectionKey={key}
                            dragHandleProps={drag.dragHandleProps ?? undefined}
                          >
                            {renderSectionEditor(key)}
                          </SectionPanel>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        {/* Preview column */}
        <div
          className={cn(
            "border-l border-border overflow-y-auto",
            "lg:w-1/2 lg:block",
            mobileTab === "preview" ? "flex-1" : "hidden lg:flex lg:flex-1"
          )}
        >
          <div className="sticky top-0 w-full">
            <ResumePreviewPdf
              data={data}
              sectionsOrder={sectionsOrder}
              name={resumeName}
              templateId={template}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
