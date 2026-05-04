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
import type { ProjectEntry } from "@/lib/profile-api";
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
} from "./_shared/format-month";
import { SortableEntryCard } from "./_shared/sortable-entry-card";
import { useSectionEntries } from "./_shared/use-section-entries";

interface ProjectsTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

export function ProjectsTab({ onDirtyChange }: ProjectsTabProps) {
  const tCommon = useTranslations("profile.common");
  const tSection = useTranslations("profile.projects");

  const { isLoading, isError, entries, saveEntries, deleteEntryWithUndo } =
    useSectionEntries<"projects">({
      sectionKey: "projects",
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

  function handleSubmitEntry(entry: ProjectEntry) {
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
      <EntryList<ProjectEntry>
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
              {item.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {item.role || "—"}
              {item.technologies && item.technologies.length > 0
                ? ` • ${item.technologies.join(", ")}`
                : ""}
            </div>
          </SortableEntryCard>
        )}
      />

      {modalOpen && (
        <ProjectFormDialog
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

const projectFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    description: z.string().trim().min(1, "Description is required"),
    role: z.string().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    is_current: z.boolean().optional(),
    technologies: z.string().optional(), // comma-separated input
    url: z.string().optional(),
    repository_url: z.string().optional(),
    details: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.start_date &&
      /^\d{4}-\d{2}$/.test(data.start_date) &&
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

type ProjectFormValues = z.infer<typeof projectFormSchema>;

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: ProjectEntry | null;
  onSubmit: (entry: ProjectEntry) => void;
}

function ProjectFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: ProjectFormDialogProps) {
  const tSection = useTranslations("profile.projects");
  const tCommon = useTranslations("profile.common");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      role: initial?.role ?? "",
      start_date: initial?.start_date ?? "",
      end_date: initial?.end_date ?? "",
      is_current: initial?.is_current ?? false,
      technologies: (initial?.technologies ?? []).join(", "),
      url: initial?.url ?? "",
      repository_url: initial?.repository_url ?? "",
      details: bulletsToTextarea(initial?.details),
    },
  });

  const isCurrent = watch("is_current");

  function submit(values: ProjectFormValues) {
    const techList: string[] = (values.technologies ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const entry: ProjectEntry = {
      id: initial?.id ?? crypto.randomUUID(),
      name: values.name.trim(),
      description: values.description.trim(),
      role: values.role?.trim() ? values.role.trim() : null,
      start_date: values.start_date?.trim() ? values.start_date : null,
      end_date: values.is_current
        ? null
        : values.end_date?.trim()
          ? values.end_date
          : null,
      is_current: !!values.is_current,
      technologies: techList,
      url: values.url?.trim() ? values.url.trim() : null,
      repository_url: values.repository_url?.trim()
        ? values.repository_url.trim()
        : null,
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
            <Label htmlFor="proj_name">
              {tSection("name")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="proj_name"
              type="text"
              {...register("name")}
              className={cn(errors.name && "border-destructive")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proj_description">
              {tSection("description")}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="proj_description"
              rows={3}
              {...register("description")}
              className={cn(errors.description && "border-destructive")}
            />
            {errors.description && (
              <p className="text-xs text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proj_role">{tSection("role")}</Label>
            <Input id="proj_role" type="text" {...register("role")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="proj_start">{tSection("startDate")}</Label>
              <Input
                id="proj_start"
                type="month"
                {...register("start_date")}
              />
            </div>
            {!isCurrent && (
              <div className="space-y-1.5">
                <Label htmlFor="proj_end">{tSection("endDate")}</Label>
                <Input
                  id="proj_end"
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
              id="proj_current"
              type="checkbox"
              {...register("is_current")}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="proj_current" className="font-normal">
              {tSection("isCurrent")}
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proj_tech">{tSection("technologies")}</Label>
            <Input
              id="proj_tech"
              type="text"
              placeholder={tSection("technologiesPlaceholder")}
              {...register("technologies")}
            />
            <p className="text-xs text-muted-foreground">
              {tSection("technologiesHint")}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="proj_url">{tSection("url")}</Label>
              <Input id="proj_url" type="text" {...register("url")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj_repo">{tSection("repositoryUrl")}</Label>
              <Input
                id="proj_repo"
                type="text"
                {...register("repository_url")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proj_details">{tSection("details")}</Label>
            <Textarea
              id="proj_details"
              rows={4}
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
