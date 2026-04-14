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
import { Textarea } from "@/components/ui/textarea";
import { useCreateFeedback } from "@/hooks/api/feedback";
import type { FeedbackType } from "@/hooks/api/feedback";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const feedbackSchema = z.object({
  type: z.enum(["bug", "feature_request", "improvement", "other"] as const),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(5000, "Message cannot exceed 5000 characters"),
});

type FeedbackFormValues = z.infer<typeof feedbackSchema>;

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const t = useTranslations();
  const [inlineError, setInlineError] = useState<string | null>(null);
  const { mutate: createFeedback, isPending } = useCreateFeedback();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isValid },
  } = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackSchema),
    mode: "onChange",
    defaultValues: {
      type: undefined,
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

  function onSubmit(values: FeedbackFormValues) {
    setInlineError(null);
    createFeedback(
      {
        type: values.type as FeedbackType,
        message: values.message,
        page_url: window.location.pathname,
      },
      {
        onSuccess: () => {
          toast.success(t("feedback.toast.success"));
          onOpenChange(false);
        },
        onError: (error) => {
          const err = error as Error & { status?: number };
          if (err.status === 429) {
            setInlineError(t("feedback.error.rate_limit"));
          } else {
            toast.error(t("feedback.error.generic"));
          }
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t("feedback.dialog.title")}</DialogTitle>
          <DialogDescription>{t("feedback.dialog.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feedback-type">{t("feedback.dialog.type.label")}</Label>
            <Select
              onValueChange={(value) => setValue("type", value as FeedbackType, { shouldValidate: true })}
            >
              <SelectTrigger id="feedback-type">
                <SelectValue placeholder={t("feedback.dialog.type.label")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">{t("feedback.dialog.type.bug")}</SelectItem>
                <SelectItem value="feature_request">{t("feedback.dialog.type.feature_request")}</SelectItem>
                <SelectItem value="improvement">{t("feedback.dialog.type.improvement")}</SelectItem>
                <SelectItem value="other">{t("feedback.dialog.type.other")}</SelectItem>
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-sm text-destructive">{errors.type.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-message">{t("feedback.dialog.message.label")}</Label>
            <Textarea
              id="feedback-message"
              rows={5}
              placeholder={t("feedback.dialog.message.placeholder")}
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
              {t("feedback.dialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
