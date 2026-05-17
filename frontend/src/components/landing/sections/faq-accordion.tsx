"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
}

export function FaqAccordion({ items }: FaqAccordionProps) {
  return (
    <Accordion
      type="single"
      defaultValue={items[0]?.id ?? "q1"}
      collapsible
      className="border border-[var(--color-border)] rounded-[14px] overflow-hidden bg-[var(--color-background)]"
    >
      {items.map((item, i) => (
        <AccordionItem
          key={item.id}
          value={item.id}
          className={
            i === 0
              ? "border-b-0 border-t-0"
              : "border-t border-[var(--color-border)] border-b-0"
          }
        >
          <AccordionTrigger className="px-7 py-[22px] font-display text-[18px] font-semibold tracking-[-0.015em] text-[var(--color-foreground)] hover:no-underline">
            {item.question}
          </AccordionTrigger>
          <AccordionContent className="px-7 pb-[22px] pt-0">
            <p className="m-0 max-w-[720px] font-body text-[16px] leading-[1.6] text-[var(--color-muted-fg)]">
              {item.answer}
            </p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
