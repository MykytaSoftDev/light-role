"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqAccordionProps {
  title: string;
  items: FaqItem[];
}

export function FaqAccordion({ title, items }: FaqAccordionProps) {
  return (
    <section className="w-full">
      <h2 className="text-foreground mb-6 text-center text-2xl font-bold">{title}</h2>
      <div className="mx-auto max-w-2xl">
        <Accordion type="single" collapsible className="w-full">
          {items.map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-sm font-semibold">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
