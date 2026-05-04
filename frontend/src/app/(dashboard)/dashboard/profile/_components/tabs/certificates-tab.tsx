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
import { cn } from "@/lib/utils";
import type { CertificateEntry } from "@/lib/profile-api";
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

interface CertificatesTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

export function CertificatesTab({ onDirtyChange }: CertificatesTabProps) {
  const tCommon = useTranslations("profile.common");
  const tSection = useTranslations("profile.certificates");

  const { isLoading, isError, entries, saveEntries, deleteEntryWithUndo } =
    useSectionEntries<"certificates">({
      sectionKey: "certificates",
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

  function handleSubmitEntry(entry: CertificateEntry) {
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
      <EntryList<CertificateEntry>
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
              {item.issuer || "—"} • {tSection("issuedLabel")}{" "}
              {formatMonth(item.issue_date)}
            </div>
          </SortableEntryCard>
        )}
      />

      {modalOpen && (
        <CertificateFormDialog
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

const certificateFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    issuer: z.string().optional(),
    issue_date: z.string().optional(),
    expiry_date: z.string().optional(),
    credential_url: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.issue_date &&
      /^\d{4}-\d{2}$/.test(data.issue_date) &&
      data.expiry_date &&
      /^\d{4}-\d{2}$/.test(data.expiry_date) &&
      data.expiry_date < data.issue_date
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiry_date"],
        message: "Expiry must be after issue date",
      });
    }
  });

type CertificateFormValues = z.infer<typeof certificateFormSchema>;

interface CertificateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: CertificateEntry | null;
  onSubmit: (entry: CertificateEntry) => void;
}

function CertificateFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: CertificateFormDialogProps) {
  const tSection = useTranslations("profile.certificates");
  const tCommon = useTranslations("profile.common");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CertificateFormValues>({
    resolver: zodResolver(certificateFormSchema),
    defaultValues: {
      name: initial?.name ?? "",
      issuer: initial?.issuer ?? "",
      issue_date: initial?.issue_date ?? "",
      expiry_date: initial?.expiry_date ?? "",
      credential_url: initial?.credential_url ?? "",
    },
  });

  function submit(values: CertificateFormValues) {
    const entry: CertificateEntry = {
      id: initial?.id ?? crypto.randomUUID(),
      name: values.name.trim(),
      issuer: values.issuer?.trim() ? values.issuer.trim() : null,
      issue_date: values.issue_date?.trim() ? values.issue_date : null,
      expiry_date: values.expiry_date?.trim() ? values.expiry_date : null,
      credential_url: values.credential_url?.trim()
        ? values.credential_url.trim()
        : null,
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
            <Label htmlFor="cert_name">
              {tSection("name")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cert_name"
              type="text"
              {...register("name")}
              className={cn(errors.name && "border-destructive")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cert_issuer">{tSection("issuer")}</Label>
            <Input id="cert_issuer" type="text" {...register("issuer")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cert_issue">{tSection("issueDate")}</Label>
              <Input
                id="cert_issue"
                type="month"
                {...register("issue_date")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cert_expiry">{tSection("expiryDate")}</Label>
              <Input
                id="cert_expiry"
                type="month"
                {...register("expiry_date")}
                className={cn(errors.expiry_date && "border-destructive")}
              />
              {errors.expiry_date && (
                <p className="text-xs text-destructive">
                  {errors.expiry_date.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cert_url">{tSection("credentialUrl")}</Label>
            <Input
              id="cert_url"
              type="text"
              {...register("credential_url")}
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
