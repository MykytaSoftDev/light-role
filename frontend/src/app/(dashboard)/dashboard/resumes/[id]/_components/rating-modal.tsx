"use client";

/**
 * TAILOR-13 — Post-generation rating modal.
 *
 * Spec: docs/v2/specs/rating-modal-spec.md (canonical).
 *
 * What this component owns:
 *   - The local star/comment UI state.
 *   - The submit POST + success/409/5xx branching (§5.2/§5.3).
 *   - The `pendingShow` queue when the editor is in Edit mode (§1.4).
 *
 * What this component does NOT own:
 *   - The 15s timer or the `markRatingModalShown` POST. Those are owned
 *     by `editor-shell.tsx` so the timer fires regardless of whether this
 *     component is mounted under a conditional. See §1.1.
 *   - The "did we already show this for this resume in this session" guard.
 *     That also lives in `editor-shell.tsx` (module-scope Set).
 *
 * Open/close contract:
 *   The parent passes `open` (boolean) and `onOpenChange(boolean)`. Parent
 *   sets `open = true` when the timer fires AND `mode === "preview"`. When
 *   the user is in Edit mode at timer-fire, parent passes `open = false`
 *   AND sets a separate `pendingShow` flag → flipping to `open = true`
 *   when the user returns to Preview mode (parent watches `mode`).
 */
import * as React from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface RatingModalProps {
  resumeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RatingModal({
  resumeId,
  open,
  onOpenChange,
}: RatingModalProps) {
  const queryClient = useQueryClient();

  const [rating, setRating] = React.useState<number>(0);
  const [comment, setComment] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const showComment = rating === 1 || rating === 2;
  const submitDisabled = rating === 0 || isSubmitting;

  // Reset local state every time the modal CLOSES so a future re-open (which
  // shouldn't happen for the same resume per spec, but is robust to mount/
  // unmount) starts clean. We reset on close-edge — not on open — so the
  // user's typed comment isn't wiped while they interact.
  React.useEffect(() => {
    if (!open) {
      setRating(0);
      setComment("");
      setIsSubmitting(false);
      setSubmitError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (submitDisabled) return;
    setIsSubmitting(true);
    setSubmitError(null);

    // Per spec §4.3: comment is null when rating ≥ 3 (textarea hidden);
    // otherwise trim and convert empty/whitespace to null.
    const trimmed = comment.trim();
    const payload = {
      rating,
      comment: showComment && trimmed.length > 0 ? trimmed : null,
    };

    try {
      await submitRating(resumeId, payload);
      // Success — update cache so subsequent re-mounts skip the modal.
      queryClient.setQueryData<TailoredResume | undefined>(
        queryKeys.resumes.detail(resumeId),
        (old) => (old ? { ...old, rating } : old)
      );
      toast.success("Thanks for the feedback!");
      onOpenChange(false);
    } catch (err) {
      if (err instanceof RatingSubmitError && err.status === 409) {
        // Already rated in another tab. Close silently — user already
        // succeeded elsewhere; congratulating them again would confuse.
        if (typeof console !== "undefined") {
          console.warn("Rating already submitted for resume", resumeId);
        }
        // Update local cache opportunistically — we don't know what value
        // the other tab submitted, but we know rating is now non-null
        // server-side. Set to current local value as a best-effort hint;
        // the next refetch will correct it if different.
        queryClient.setQueryData<TailoredResume | undefined>(
          queryKeys.resumes.detail(resumeId),
          (old) => (old && old.rating === null ? { ...old, rating } : old)
        );
        onOpenChange(false);
        return;
      }
      // 5xx / network / unknown → keep modal open with inline error.
      setSubmitError("Couldn't save your rating. Please try again.");
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);
  };

  // While submitting we don't want a stray Esc/backdrop close to drop the
  // in-flight submit's UI feedback. Lock close paths during submit.
  const handleOpenChange = (next: boolean) => {
    if (isSubmitting && !next) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How was the result?</DialogTitle>
          <DialogDescription>
            Help us improve by rating your tailored resume.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="py-2">
            <RatingStars
              value={rating}
              onChange={(next) => {
                setRating(next);
                // Clear inline error when the user adjusts after a failure.
                if (submitError) setSubmitError(null);
              }}
              disabled={isSubmitting}
            />
          </div>

          {/* Conditional comment region. Grid-rows trick gives a height
              transition without measuring; opacity softens appearance. The
              `motion-safe:` prefix means reduced-motion users see no
              animation (still functional). */}
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
              <Label htmlFor="rating-comment">
                Tell us what went wrong (optional)
              </Label>
              <Textarea
                id="rating-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
                placeholder="What was missing or off about this resume?"
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
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Skip
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitDisabled}
          >
            {isSubmitting ? "Submitting…" : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
