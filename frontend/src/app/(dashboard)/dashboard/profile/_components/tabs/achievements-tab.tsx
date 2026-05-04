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
import type { AchievementEntry } from "@/lib/profile-api";
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

interface AchievementsTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

export function AchievementsTab({ onDirtyChange }: AchievementsTabProps) {
  const tCommon = useTranslations("profile.common");
  const tSection = useTranslations("profile.achievements");

  const { isLoading, isError, entries, saveEntries, deleteEntryWithUndo } =
    useSectionEntries<"achievements">({
      sectionKey: "achievements",
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

  function handleSubmitEntry(entry: AchievementEntry) {
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
      <EntryList<AchievementEntry>
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
              {item.title}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatMonth(item.date)}
              {item.issuer ? ` • ${item.issuer}` : ""}
            </div>
          </SortableEntryCard>
        )}
      />

      {modalOpen && (
        <AchievementFormDialog
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

const achievementFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().optional(),
  date: z.string().optional(),
  issuer: z.string().optional(),
});

type AchievementFormValues = z.infer<typeof achievementFormSchema>;

interface AchievementFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: AchievementEntry | null;
  onSubmit: (entry: AchievementEntry) => void;
}

function AchievementFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: AchievementFormDialogProps) {
  const tSection = useTranslations("profile.achievements");
  const tCommon = useTranslations("profile.common");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AchievementFormValues>({
    resolver: zodResolver(achievementFormSchema),
    defaultValues: {
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      date: initial?.date ?? "",
      issuer: initial?.issuer ?? "",
    },
  });

  function submit(values: AchievementFormValues) {
    const entry: AchievementEntry = {
      id: initial?.id ?? crypto.randomUUID(),
      title: values.title.trim(),
      description: values.description?.trim()
        ? values.description.trim()
        : null,
      date: values.date?.trim() ? values.date : null,
      issuer: values.issuer?.trim() ? values.issuer.trim() : null,
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
            <Label htmlFor="ach_title">
              {tSection("title")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ach_title"
              type="text"
              {...register("title")}
              className={cn(errors.title && "border-destructive")}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ach_description">{tSection("description")}</Label>
            <Textarea
              id="ach_description"
              rows={3}
              {...register("description")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ach_date">{tSection("date")}</Label>
              <Input id="ach_date" type="month" {...register("date")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ach_issuer">{tSection("issuer")}</Label>
              <Input id="ach_issuer" type="text" {...register("issuer")} />
            </div>
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
