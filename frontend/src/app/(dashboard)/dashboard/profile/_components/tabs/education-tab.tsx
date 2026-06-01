"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { EducationEntry } from "@/lib/profile-api";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { EntryList } from "./_shared/entry-list";
import { formatMonth } from "./_shared/format-month";
import { SortableEntryCard } from "./_shared/sortable-entry-card";
import { useSectionEntries } from "./_shared/use-section-entries";

interface EducationTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

export function EducationTab({ onDirtyChange }: EducationTabProps) {
  const tCommon = useTranslations("profile.common");
  const tSection = useTranslations("profile.education");

  const { isLoading, isError, entries, saveEntries, deleteEntryWithUndo } =
    useSectionEntries<"education">({
      sectionKey: "education",
      successMessage: tCommon("savedToast"),
      errorMessage: tCommon("saveErrorToast"),
      deletedMessage: tCommon("deletedToast"),
      undoLabel: tCommon("undoButton"),
      deleteErrorMessage: tCommon("deleteFailedToast"),
    });

  useEffect(() => {
    onDirtyChange?.(false);
  }, [onDirtyChange]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  function handleSubmitEntry(entry: EducationEntry) {
    if (editIndex === null) {
      saveEntries([...entries, entry]);
    } else {
      const next = entries.slice();
      next[editIndex] = entry;
      saveEntries(next);
    }
    setModalOpen(false);
    setEditIndex(null);
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 w-full animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
        <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span>{tCommon("loadErrorMessage")}</span>
      </div>
    );
  }

  return (
    <>
      <EntryList<EducationEntry>
        items={entries}
        onReorder={(next) => saveEntries(next)}
        onAdd={() => {
          setEditIndex(null);
          setModalOpen(true);
        }}
        addButtonLabel={tSection("addButton")}
        emptyMessage={tSection("empty")}
        heading={tSection("heading")}
        description={tSection("description")}
        renderCard={(item, index) => (
          <SortableEntryCard
            id={item.id ?? String(index)}
            onEdit={() => {
              setEditIndex(index);
              setModalOpen(true);
            }}
            onDelete={() => deleteEntryWithUndo(index)}
          >
            <div className="text-sm font-semibold text-foreground">
              {item.degree}{" "}
              <span className="font-normal text-muted-foreground">
                at {item.institution}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {item.field_of_study ? `${item.field_of_study} • ` : ""}
              {formatMonth(item.start_date)} –{" "}
              {item.is_current
                ? tSection("present")
                : formatMonth(item.end_date)}
            </div>
          </SortableEntryCard>
        )}
      />

      {modalOpen && (
        <EducationFormDialog
          open={modalOpen}
          onOpenChange={(open) => {
            setModalOpen(open);
            if (!open) setEditIndex(null);
          }}
          initial={editIndex !== null ? entries[editIndex] : null}
          onSubmit={handleSubmitEntry}
        />
      )}
    </>
  );
}

const educationFormSchema = z
  .object({
    degree: z.string().trim().min(1, "Degree is required"),
    institution: z.string().trim().min(1, "Institution is required"),
    field_of_study: z.string().optional(),
    location: z.string().optional(),
    start_date: z
      .string()
      .regex(/^\d{4}-\d{2}$/, "Start date is required (YYYY-MM)"),
    end_date: z.string().optional(),
    is_current: z.boolean().optional(),
    description: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.is_current) {
      if (!data.end_date || !/^\d{4}-\d{2}$/.test(data.end_date)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["end_date"],
          message: "End date is required",
        });
        return;
      }
    }
    if (
      data.end_date &&
      /^\d{4}-\d{2}$/.test(data.end_date) &&
      data.end_date < data.start_date
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_date"],
        message: "End date must be after start date",
      });
    }
  });

type EducationFormValues = z.infer<typeof educationFormSchema>;

interface EducationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: EducationEntry | null;
  onSubmit: (entry: EducationEntry) => void;
}

function EducationFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: EducationFormDialogProps) {
  const tSection = useTranslations("profile.education");
  const tCommon = useTranslations("profile.common");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EducationFormValues>({
    resolver: zodResolver(educationFormSchema),
    defaultValues: {
      degree: initial?.degree ?? "",
      institution: initial?.institution ?? "",
      field_of_study: initial?.field_of_study ?? "",
      location: initial?.location ?? "",
      start_date: initial?.start_date ?? "",
      end_date: initial?.end_date ?? "",
      is_current: initial?.is_current ?? false,
      description: initial?.description ?? "",
    },
  });

  const isCurrent = watch("is_current");

  function submit(values: EducationFormValues) {
    const entry: EducationEntry = {
      id: initial?.id ?? crypto.randomUUID(),
      degree: values.degree.trim(),
      institution: values.institution.trim(),
      field_of_study: values.field_of_study?.trim()
        ? values.field_of_study.trim()
        : null,
      location: values.location?.trim() ? values.location.trim() : null,
      start_date: values.start_date,
      end_date: values.is_current
        ? null
        : values.end_date && values.end_date.trim() !== ""
          ? values.end_date
          : null,
      is_current: !!values.is_current,
      description: values.description?.trim() ? values.description.trim() : null,
    };
    onSubmit(entry);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {initial ? tSection("modalTitleEdit") : tSection("modalTitleAdd")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edu_degree">
              {tSection("degree")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edu_degree"
              type="text"
              {...register("degree")}
              className={cn(errors.degree && "border-destructive")}
            />
            {errors.degree && (
              <p className="text-xs text-destructive">{errors.degree.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edu_institution">
              {tSection("institution")}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edu_institution"
              type="text"
              {...register("institution")}
              className={cn(errors.institution && "border-destructive")}
            />
            {errors.institution && (
              <p className="text-xs text-destructive">
                {errors.institution.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edu_field">{tSection("fieldOfStudy")}</Label>
              <Input
                id="edu_field"
                type="text"
                {...register("field_of_study")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edu_location">{tSection("location")}</Label>
              <Input id="edu_location" type="text" {...register("location")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edu_start">
                {tSection("startDate")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edu_start"
                type="month"
                {...register("start_date")}
                className={cn(errors.start_date && "border-destructive")}
              />
              {errors.start_date && (
                <p className="text-xs text-destructive">
                  {errors.start_date.message}
                </p>
              )}
            </div>
            {!isCurrent && (
              <div className="space-y-1.5">
                <Label htmlFor="edu_end">{tSection("endDate")}</Label>
                <Input
                  id="edu_end"
                  type="month"
                  {...register("end_date")}
                  className={cn(errors.end_date && "border-destructive")}
                />
                {errors.end_date && (
                  <p className="text-xs text-destructive">
                    {errors.end_date.message}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              id="edu_current"
              type="checkbox"
              {...register("is_current")}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="edu_current" className="font-normal">
              {tSection("isCurrent")}
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edu_description">{tSection("description")}</Label>
            <Textarea
              id="edu_description"
              rows={4}
              {...register("description")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tCommon("cancelButton")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {tCommon("saveButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
