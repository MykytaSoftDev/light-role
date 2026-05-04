/**
 * Format a "YYYY-MM" string for human display.
 * Examples: "2024-03" -> "Mar 2024", "" / null -> fallback.
 */
export function formatMonth(value?: string | null, fallback = "—"): string {
  if (!value) return fallback;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
  if (monthIdx < 0 || monthIdx > 11) return value;
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${monthNames[monthIdx]} ${year}`;
}

/** Convert textarea string to bullet array: split by newline, drop empty. */
export function bulletsFromTextarea(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Convert bullet array back to textarea content (join by newline). */
export function bulletsToTextarea(bullets: string[] | undefined): string {
  if (!bullets) return "";
  return bullets.join("\n");
}
