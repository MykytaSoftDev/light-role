"use client";

/**
 * TAILOR-8 — Insights side-panel placeholder.
 *
 * TAILOR-12 replaces this with the real Matched Keywords + Applied Changes
 * accordion. For now it's a sticky Card with a single "coming soon" body.
 *
 * Spec: docs/v2/specs/tailor-flow-spec.md §3.8.
 */
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function InsightsPanelPlaceholder() {
  return (
    <aside
      role="complementary"
      aria-label="Insights"
      className="sticky top-6"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Matched keywords and AI insights coming soon.
          </p>
        </CardContent>
      </Card>
    </aside>
  );
}
