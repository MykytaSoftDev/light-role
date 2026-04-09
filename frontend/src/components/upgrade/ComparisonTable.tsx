"use client";

import { Check } from "lucide-react";

export interface ComparisonRow {
  feature: string;
  free: string;
  pro: string;
}

export interface ComparisonTableProps {
  title: string;
  colFeature: string;
  colFree: string;
  colPro: string;
  rows: ComparisonRow[];
}

function CellValue({ value }: { value: string }) {
  if (value === "Yes" || value === "true") {
    return <Check className="mx-auto h-4 w-4 text-indigo-500" aria-label="Yes" />;
  }
  if (value === "—" || value === "-" || value === "No") {
    return <span className="text-muted-foreground">{value === "No" ? "—" : value}</span>;
  }
  return <span>{value}</span>;
}

export function ComparisonTable({
  title,
  colFeature,
  colFree,
  colPro,
  rows,
}: ComparisonTableProps) {
  return (
    <section className="w-full">
      <h2 className="text-foreground mb-6 text-center text-2xl font-bold">{title}</h2>

      {/* Desktop table */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted text-muted-foreground">
              <th className="px-6 py-3 text-left font-semibold">{colFeature}</th>
              <th className="px-6 py-3 text-center font-semibold">{colFree}</th>
              <th className="px-6 py-3 text-center font-semibold text-indigo-600 dark:text-indigo-400">
                {colPro}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-t border-border even:bg-muted/30 transition-colors"
              >
                <td className="px-6 py-3 font-medium text-foreground">{row.feature}</td>
                <td className="px-6 py-3 text-center text-muted-foreground">
                  <CellValue value={row.free} />
                </td>
                <td className="px-6 py-3 text-center text-foreground font-medium">
                  <CellValue value={row.pro} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: two stacked cards */}
      <div className="flex flex-col gap-4 md:hidden">
        {/* Free card */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="bg-muted px-4 py-2">
            <span className="text-sm font-semibold text-muted-foreground">{colFree}</span>
          </div>
          <ul className="divide-y divide-border">
            {rows.map((row, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">{row.feature}</span>
                <span className="font-medium text-foreground">
                  <CellValue value={row.free} />
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Pro card */}
        <div className="rounded-xl border-2 border-indigo-500 overflow-hidden">
          <div className="bg-indigo-50 dark:bg-indigo-950 px-4 py-2">
            <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
              {colPro}
            </span>
          </div>
          <ul className="divide-y divide-border">
            {rows.map((row, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">{row.feature}</span>
                <span className="font-medium text-foreground">
                  <CellValue value={row.pro} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
