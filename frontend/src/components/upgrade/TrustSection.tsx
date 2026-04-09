"use client";

import type { LucideIcon } from "lucide-react";

export interface TrustItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface TrustSectionProps {
  title: string;
  items: TrustItem[];
}

export function TrustSection({ title, items }: TrustSectionProps) {
  return (
    <section className="w-full">
      <h2 className="text-foreground mb-8 text-center text-2xl font-bold">{title}</h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={i}
              className="flex flex-col items-center rounded-xl border border-border bg-card p-6 text-center"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950">
                <Icon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-foreground mb-2 text-base font-semibold">{item.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
