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
import type { VolunteerEntry } from "@/lib/profile-api";
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

interface VolunteerTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

export function VolunteerTab({ onDirtyChange }: VolunteerTabProps) {
  const tCommon = useTranslations("profile.common");
  const tSection = useTranslations("profile.volunteer");

  const { isLoading, isError, entries, saveEntries, deleteEntryWithUndo } =
    useSectionEntries<"volunteer">({
      sectionKey: "volunteer",
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

  function handleSubmitEntry(entry: VolunteerEntry) {
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
      <EntryList<VolunteerEntry>
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
              {item.role}{" "}
              <span className="font-normal text-muted-foreground">
                at {item.organization}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {formatMonth(item.start_date)} –{" "}
              {item.is_current
                ? tSection("present")
                : formatMonth(item.end_date)}
            </div>
          </SortableEntryCard>
        )}
      />

      {modalOpen && (
        <VolunteerFormDialog
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

const volunteerFormSchema = z
  .object({
    role: z.string().trim().min(1, "Role is required"),
    organization: z.string().trim().min(1, "Organization is required"),
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

type VolunteerFormValues = z.infer<typeof volunteerFormSchema>;

interface VolunteerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: VolunteerEntry | null;
  onSubmit: (entry: VolunteerEntry) => void;
}

function VolunteerFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: VolunteerFormDialogProps) {
  const tSection = useTranslations("profile.volunteer");
  const tCommon = useTranslations("profile.common");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<VolunteerFormValues>({
    resolver: zodResolver(volunteerFormSchema),
    defaultValues: {
      role: initial?.role ?? "",
      organization: initial?.organization ?? "",
      location: initial?.location ?? "",
      start_date: initial?.start_date ?? "",
      end_date: initial?.end_date ?? "",
      is_current: initial?.is_current ?? false,
      details: bulletsToTextarea(initial?.details),
    },
  });

  const isCurrent = watch("is_current");

  function submit(values: VolunteerFormValues) {
    const entry: VolunteerEntry = {
      id: initial?.id ?? crypto.randomUUID(),
      role: values.role.trim(),
      organization: values.organization.trim(),
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
            <Label htmlFor="vol_role">
              {tSection("role")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="vol_role"
              type="text"
              {...register("role")}
              className={cn(errors.role && "border-destructive")}
            />
            {errors.role && (
              <p className="text-xs text-destructive">{errors.role.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vol_org">
              {tSection("organization")}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="vol_org"
              type="text"
              {...register("organization")}
              className={cn(errors.organization && "border-destructive")}
            />
            {errors.organization && (
              <p className="text-xs text-destructive">
                {errors.organization.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vol_location">{tSection("location")}</Label>
            <Input id="vol_location" type="text" {...register("location")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vol_start">
                {tSection("startDate")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="vol_start"
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
                <Label htmlFor="vol_end">{tSection("endDate")}</Label>
                <Input
                  id="vol_end"
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
              id="vol_current"
              type="checkbox"
              {...register("is_current")}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="vol_current" className="font-normal">
              {tSection("isCurrent")}
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vol_details">{tSection("details")}</Label>
            <Textarea
              id="vol_details"
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
