"use client";

/**
 * TAILOR-13 (revised) — Post-generation rating card.
 *
 * Spec: docs/v2/specs/rating-card-spec.md (canonical; supersedes the prior
 * `rating-modal-spec.md`).
 *
 * What changed vs the previous `<RatingModal>`:
 *   - Surface: shadcn `<Card>` inside the side-panel column, NOT a centered
 *     blocking `<Dialog>`. The user can read, scroll, and edit the document
 *     freely while the card is visible.
 *   - Dismiss path: only the header × button. No Skip, no Esc, no backdrop.
 *   - In-flight submit no longer locks the dismiss path — the user can ×
 *     the card while a submit is in flight; the request finishes in the
 *     background and the cache update from the success branch still lands.
 *   - Stars are 28px (`size="sm"`) instead of 36px to fit the 320px column.
 *   - In Edit mode the card stays visible, dimmed to opacity 0.7 (per spec
 *     §1.4). The previous `pendingShow` deferral lived in `editor-shell.tsx`
 *     and has been removed.
 *
 * What this component owns:
 *   - The local star/comment/submit UI state.
 *   - The submit POST + 201/409/5xx branching (spec §5.3, §5.4).
 *
 * What this component does NOT own:
 *   - The 15s timer.
 *   - The `markRatingModalShown` POST.
 *   - The per-session "did we already arm for this resume" guard.
 *
 *   Those all live in `editor-shell.tsx` so the timer fires regardless of
 *   whether this card is mounted (matters when the user closes the tab during
 *   the 15-second window). See spec §1.1.
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/hooks/api/keys";
import {
  RatingSubmitError,
  submitRating,
  type TailoredResume,
} from "@/lib/tailored-resume-api";

import { RatingStars } from "./rating-stars";

interface RatingCardProps {
  resumeId: string;
  /** Drives the opacity-0.7 dim. The card stays fully interactive while dimmed. */
  isEditMode: boolean;
  /** Called by the header × and after a 201 / 409 close. */
  onClose: () => void;
}

export function RatingCard({
  resumeId,
  isEditMode,
  onClose,
}: RatingCardProps) {
  const t = useTranslations("Resumes.editor.rating");
  const queryClient = useQueryClient();

  const [rating, setRating] = React.useState<number>(0);
  const [comment, setComment] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const showComment = rating === 1 || rating === 2;
  const submitDisabled = rating === 0 || isSubmitting;

  const handleSubmit = async () => {
    if (submitDisabled) return;
    setIsSubmitting(true);
    setSubmitError(null);

    // Per spec §4: comment is null when rating ≥ 3 (textarea hidden); else
    // trim and convert empty/whitespace to null.
    const trimmed = comment.trim();
    const payload = {
      rating,
      comment: showComment && trimmed.length > 0 ? trimmed : null,
    };

    try {
      await submitRating(resumeId, payload);
      // Success — update cache so subsequent re-mounts skip the card.
      queryClient.setQueryData<TailoredResume | undefined>(
        queryKeys.resumes.detail(resumeId),
        (old) => (old ? { ...old, rating } : old)
      );
      toast.success(t("thanksToast"));
      onClose();
    } catch (err) {
      if (err instanceof RatingSubmitError && err.status === 409) {
        // Already rated in another tab. Close silently — congratulating the
        // user again would confuse.
        if (typeof console !== "undefined") {
          console.warn("Rating already submitted for resume", resumeId);
        }
        // Best-effort cache hint; next refetch corrects if different.
        queryClient.setQueryData<TailoredResume | undefined>(
          queryKeys.resumes.detail(resumeId),
          (old) => (old && old.rating === null ? { ...old, rating } : old)
        );
        onClose();
        return;
      }
      // 5xx / network / unknown → keep card open with inline error.
      setSubmitError(t("submitError"));
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);
  };

  // Dismiss is unconditional — even mid-submit. The in-flight request continues
  // in the background; the success branch's cache update still lands. Spec §5.5.
  const handleDismiss = () => {
    onClose();
  };

  return (
    <Card
      className={cn(
        "transition-opacity duration-200",
        isEditMode && "opacity-70"
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">{t("cardTitle")}</CardTitle>
          <CardDescription>{t("cardDescription")}</CardDescription>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-2 h-7 w-7 shrink-0"
          aria-label={t("dismissAria")}
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="py-1">
          <RatingStars
            value={rating}
            onChange={(next) => {
              setRating(next);
              // Clear inline error when user adjusts after a failure.
              if (submitError) setSubmitError(null);
            }}
            disabled={isSubmitting}
            size="sm"
          />
        </div>

        {/* Conditional comment region. Grid-rows trick gives a height
            transition without measuring; opacity softens appearance. The
            `motion-safe:` prefix means reduced-motion users see no animation
            (still functional). */}
        <div
          className={cn(
            "grid overflow-hidden transition-all ease-out motion-safe:duration-200",
            showComment
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          )}
          aria-hidden={!showComment}
        >
          <div className="min-h-0 space-y-2">
            <Label htmlFor="rating-comment">{t("commentLabel")}</Label>
            <Textarea
              id="rating-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              placeholder={t("commentPlaceholder")}
              disabled={isSubmitting || !showComment}
              tabIndex={showComment ? 0 : -1}
            />
          </div>
        </div>

        {submitError ? (
          <p className="text-sm text-destructive" role="alert">
            {submitError}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitDisabled}
          >
            {isSubmitting ? t("submitting") : t("submit")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
