"use client";

import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";

const statusClasses: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  trialing: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
  canceled: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20",
  past_due: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
  paused: "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/20",
  completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  paid: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  billed: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
};

// Map known status keys to dictionary lookups. Falls back to the raw status
// string when no translation is available (e.g. backend introduces a new
// status before i18n is updated).
const STATUS_TRANSLATIONS: Record<string, { ns: string; key: string }> = {
  active: { ns: "Subscriptions.details", key: "active" },
  trialing: { ns: "Subscriptions.details", key: "trialing" },
  canceled: { ns: "Subscriptions.details", key: "canceled" },
  past_due: { ns: "Subscriptions.details", key: "pastDue" },
  paused: { ns: "Subscriptions.details", key: "paused" },
  paid: { ns: "Payments.status", key: "paid" },
  // Note: "completed" and "billed" fall through to the raw-status fallback
  // below — they don't currently have dedicated dictionary entries.
};

interface Props {
  status: string;
}

export function Status({ status }: Props) {
  // We pull the whole top-level translator and resolve dynamically; this is a
  // small price for a single shared component used across many flows.
  const tSubs = useTranslations("Subscriptions.details");
  const tPayments = useTranslations("Payments.status");

  const className =
    statusClasses[status] ??
    "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/20";

  let label: string;
  const map = STATUS_TRANSLATIONS[status];
  if (map?.ns === "Subscriptions.details") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    label = tSubs(map.key as any);
  } else if (map?.ns === "Payments.status") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    label = tPayments(map.key as any);
  } else {
    // Fallback: capitalize the raw status code (e.g. "completed" → "Completed")
    label = status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
  }

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}
