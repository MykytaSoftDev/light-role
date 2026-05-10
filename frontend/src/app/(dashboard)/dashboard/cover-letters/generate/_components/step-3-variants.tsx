"use client";

/**
 * CL-7 — Step 3: Review Variants.
 *
 * Three tabs (one per AI variant). Each tab has a "Use this variant" button
 * that toggles `selectedVariantIdx`. The Edit Selected footer button fires
 * the CL-3 finalize mutation; on 201 the wizard navigates to the editor.
 *
 * Regenerate intentionally OMITTED for MVP — see PRD §20 Future Enhancements
 * and the comment block at the bottom of this file. Re-enable carefully via
 * A/B test.
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, ArrowRight, Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { CoverLetterVariantContent } from "@/lib/cover-letter-api";

interface Step3Props {
  variants: CoverLetterVariantContent[];
  selectedVariantIdx: number | null;
  isFinalizing: boolean;
  onSelectVariant: (idx: number) => void;
  onFinalize: () => void;
}

export function Step3Variants({
  variants,
  selectedVariantIdx,
  isFinalizing,
  onSelectVariant,
  onFinalize,
}: Step3Props) {
  const t = useTranslations("coverLetters.wizard");
  const [activeTab, setActiveTab] = React.useState<string>("v0");

  // Defensive guard — should never trigger in normal flow (Loading guarantees
  // 3 variants before transitioning to Step 3).
  if (!variants || variants.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{t("step3.defensiveError")}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const tabLabels = [
    t("step3.tab.variant1"),
    t("step3.tab.variant2"),
    t("step3.tab.variant3"),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("step3.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("step3.subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            {variants.map((_, idx) => (
              <TabsTrigger
                key={idx}
                value={`v${idx}`}
                className="relative"
              >
                <span className="flex items-center gap-1.5">
                  {tabLabels[idx]}
                  {selectedVariantIdx === idx && (
                    <Check
                      className="h-3.5 w-3.5 text-primary"
                      aria-label={t("step3.selected")}
                    />
                  )}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {variants.map((variant, idx) => {
            const isSelected = selectedVariantIdx === idx;
            return (
              <TabsContent key={idx} value={`v${idx}`} className="mt-4">
                <div className="rounded-lg border border-border bg-card">
                  {/* Toolbar */}
                  <div className="flex items-center justify-end border-b border-border px-4 py-2">
                    <Button
                      size="sm"
                      variant={isSelected ? "secondary" : "default"}
                      onClick={() => onSelectVariant(idx)}
                      disabled={isSelected}
                    >
                      {isSelected ? (
                        <>
                          <Check className="mr-1.5 h-4 w-4" />
                          {t("step3.selected")}
                        </>
                      ) : (
                        t("step3.useVariant")
                      )}
                    </Button>
                  </div>
                  {/* Body */}
                  <article
                    className={cn(
                      "max-h-[480px] overflow-y-auto whitespace-pre-wrap px-6 py-5 text-sm leading-relaxed text-foreground",
                      "sm:px-6 sm:py-5",
                    )}
                  >
                    {variant.content}
                  </article>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>

        {/* Footer */}
        <div className="flex justify-end border-t border-border pt-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={
                    selectedVariantIdx === null ? "cursor-not-allowed" : undefined
                  }
                >
                  <Button
                    type="button"
                    onClick={onFinalize}
                    disabled={selectedVariantIdx === null || isFinalizing}
                  >
                    {isFinalizing ? (
                      <>
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        {t("step3.saving")}
                      </>
                    ) : (
                      <>
                        {t("step3.editSelected")}
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              {selectedVariantIdx === null && (
                <TooltipContent>{t("step3.pickFirst")}</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}

/*
  COMMENTED OUT FOR MVP — see PRD Section 20 (Future Enhancements).
  Re-enable carefully via an A/B test once we have data on whether users
  actually want a second AI generation in the same session.

  The associated `regenerateCoverLetter` API helper still lives in
  `frontend/src/lib/cover-letter-api.ts` so a future re-enable is one
  import + one button away.

  <Button
    variant="outline"
    size="sm"
    className="gap-1.5"
    onClick={handleRegenerate}
    disabled={isGenerating || aiAtLimit}
  >
    <RefreshCw className="h-3 w-3" />
    Regenerate
  </Button>
*/
