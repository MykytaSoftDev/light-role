"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { EmploymentEntry } from "@/lib/profile-api";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { EntryList } from "./_shared/entry-list";
import {
  bulletsFromTextarea,
  bulletsToTextarea,
  formatMonth,
} from "./_shared/format-month";
import { SortableEntryCard } from "./_shared/sortable-entry-card";
import { useSectionEntries } from "./_shared/use-section-entries";

interface EmploymentTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

export function EmploymentTab({ onDirtyChange }: EmploymentTabProps) {
  const tCommon = useTranslations("profile.common");
  const tSection = useTranslations("profile.employment");

  const { isLoading, isError, entries, saveEntries, deleteEntryWithUndo } =
    useSectionEntries<"employment">({
      sectionKey: "employment",
      successMessage: tCommon("savedToast"),
      errorMessage: tCommon("saveErrorToast"),
      deletedMessage: tCommon("deletedToast"),
      undoLabel: tCommon("undoButton"),
      deleteErrorMessage: tCommon("deleteFailedToast"),
    });

  // Card-list tabs save inline on every action so they're never "dirty"
  // from the parent's perspective. Always report false.
  useEffect(() => {
    onDirtyChange?.(false);
  }, [onDirtyChange]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  function openAdd() {
    setEditIndex(null);
    setModalOpen(true);
  }

  function openEdit(index: number) {
    setEditIndex(index);
    setModalOpen(true);
  }

  function handleSubmitEntry(entry: EmploymentEntry) {
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

  function handleReorder(next: EmploymentEntry[]) {
    saveEntries(next);
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
      <EntryList<EmploymentEntry>
        items={entries}
        onReorder={handleReorder}
        onAdd={openAdd}
        addButtonLabel={tSection("addButton")}
        emptyMessage={tSection("empty")}
        heading={tSection("heading")}
        description={tSection("description")}
        renderCard={(item, index) => (
          <SortableEntryCard
            id={item.id ?? String(index)}
            onEdit={() => openEdit(index)}
            onDelete={() => deleteEntryWithUndo(index)}
          >
            <div className="text-sm font-semibold text-foreground">
              {item.role}{" "}
              <span className="font-normal text-muted-foreground">
                at {item.company}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {formatMonth(item.start_date)} —{" "}
              {item.is_current
                ? tSection("present")
                : formatMonth(item.end_date)}
            </div>
          </SortableEntryCard>
        )}
      />

      {modalOpen && (
        <EmploymentFormDialog
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

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

const employmentFormSchema = z
  .object({
    role: z.string().trim().min(1, "Role is required"),
    company: z.string().trim().min(1, "Company is required"),
    location: z.string().optional(),
    start_date: z
      .string()
      .regex(/^\d{4}-\d{2}$/, "Start date is required (YYYY-MM)"),
    end_date: z.string().optional(),
    is_current: z.boolean().optional(),
    details: z.string().optional(),
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

type EmploymentFormValues = z.infer<typeof employmentFormSchema>;

interface EmploymentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: EmploymentEntry | null;
  onSubmit: (entry: EmploymentEntry) => void;
}

function EmploymentFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: EmploymentFormDialogProps) {
  const tSection = useTranslations("profile.employment");
  const tCommon = useTranslations("profile.common");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EmploymentFormValues>({
    resolver: zodResolver(employmentFormSchema),
    defaultValues: {
      role: initial?.role ?? "",
      company: initial?.company ?? "",
      location: initial?.location ?? "",
      start_date: initial?.start_date ?? "",
      end_date: initial?.end_date ?? "",
      is_current: initial?.is_current ?? false,
      details: bulletsToTextarea(initial?.details),
    },
  });

  const isCurrent = watch("is_current");

  function submit(values: EmploymentFormValues) {
    const entry: EmploymentEntry = {
      id: initial?.id ?? crypto.randomUUID(),
      role: values.role.trim(),
      company: values.company.trim(),
      location: values.location?.trim() ? values.location.trim() : null,
      start_date: values.start_date,
      end_date: values.is_current
        ? null
        : values.end_date && values.end_date.trim() !== ""
          ? values.end_date
          : null,
      is_current: !!values.is_current,
      details: bulletsFromTextarea(values.details ?? ""),
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
            <Label htmlFor="emp_role">
              {tSection("role")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="emp_role"
              type="text"
              {...register("role")}
              className={cn(errors.role && "border-destructive")}
            />
            {errors.role && (
              <p className="text-xs text-destructive">{errors.role.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp_company">
              {tSection("company")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="emp_company"
              type="text"
              {...register("company")}
              className={cn(errors.company && "border-destructive")}
            />
            {errors.company && (
              <p className="text-xs text-destructive">{errors.company.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp_location">{tSection("location")}</Label>
            <Input id="emp_location" type="text" {...register("location")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="emp_start">
                {tSection("startDate")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="emp_start"
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
                <Label htmlFor="emp_end">{tSection("endDate")}</Label>
                <Input
                  id="emp_end"
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
              id="emp_current"
              type="checkbox"
              {...register("is_current")}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="emp_current" className="font-normal">
              {tSection("isCurrent")}
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp_details">{tSection("details")}</Label>
            <Textarea
              id="emp_details"
              rows={5}
              placeholder={tSection("detailsPlaceholder")}
              {...register("details")}
            />
            <p className="text-xs text-muted-foreground">
              {tSection("detailsHint")}
            </p>
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
