"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/hooks/api/useUser";
import { useSendSupportMessage } from "@/hooks/api/support";
import type { SupportCategory } from "@/hooks/api/support";

interface SupportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const supportSchema = z.object({
  category: z.enum(["account", "billing", "technical", "other"] as const),
  subject: z
    .string()
    .min(1, "Subject is required")
    .max(200, "Subject cannot exceed 200 characters"),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(5000, "Message cannot exceed 5000 characters"),
});

type SupportFormValues = z.infer<typeof supportSchema>;

export function SupportDialog({ open, onOpenChange }: SupportDialogProps) {
  const t = useTranslations();
  const [inlineError, setInlineError] = useState<string | null>(null);
  const { data: user } = useUser();
  const { mutate: sendSupportMessage, isPending } = useSendSupportMessage();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isValid },
  } = useForm<SupportFormValues>({
    resolver: zodResolver(supportSchema),
    mode: "onChange",
    defaultValues: {
      category: undefined,
      subject: "",
      message: "",
    },
  });

  const messageValue = watch("message") ?? "";

  useEffect(() => {
    if (!open) {
      reset();
      setInlineError(null);
    }
  }, [open, reset]);

  function onSubmit(values: SupportFormValues) {
    setInlineError(null);
    sendSupportMessage(
      {
        category: values.category as SupportCategory,
        subject: values.subject,
        message: values.message,
      },
      {
        onSuccess: () => {
          toast.success(t("support.toast.success"));
          onOpenChange(false);
        },
        onError: (error) => {
          const err = error as Error & { status?: number };
          if (err.status === 429) {
            setInlineError(t("support.error.rate_limit"));
          } else if (err.status === 503) {
            setInlineError(t("support.error.unavailable"));
          } else {
            toast.error(t("feedback.error.generic"));
          }
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{t("support.dialog.title")}</DialogTitle>
          <DialogDescription>{t("support.dialog.description")}</DialogDescription>
        </DialogHeader>

        {user?.email && (
          <p className="text-sm text-muted-foreground -mt-2">
            {t("support.dialog.reply_to_notice", { email: user.email })}
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="support-category">{t("support.dialog.category.label")}</Label>
            <Select
              onValueChange={(value) =>
                setValue("category", value as SupportCategory, { shouldValidate: true })
              }
            >
              <SelectTrigger id="support-category">
                <SelectValue placeholder={t("support.dialog.category.label")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="account">{t("support.dialog.category.account")}</SelectItem>
                <SelectItem value="billing">{t("support.dialog.category.billing")}</SelectItem>
                <SelectItem value="technical">{t("support.dialog.category.technical")}</SelectItem>
                <SelectItem value="other">{t("support.dialog.category.other")}</SelectItem>
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-sm text-destructive">{errors.category.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="support-subject">{t("support.dialog.subject.label")}</Label>
            <Input
              id="support-subject"
              maxLength={200}
              {...register("subject")}
            />
            {errors.subject && (
              <p className="text-sm text-destructive">{errors.subject.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="support-message">{t("support.dialog.message.label")}</Label>
            <Textarea
              id="support-message"
              rows={6}
              {...register("message")}
            />
            <div className="flex justify-between items-center">
              {errors.message ? (
                <p className="text-sm text-destructive">{errors.message.message}</p>
              ) : (
                <span />
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {messageValue.length}/5000
              </span>
            </div>
          </div>

          {inlineError && (
            <p className="text-sm text-destructive">{inlineError}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {t("feedback.dialog.cancel")}
            </Button>
            <Button type="submit" disabled={isPending || !isValid}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("support.dialog.send")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
