import type { Metadata } from "next";
import { PricingPageContent } from "./_components/pricing-page-content";

// SEO metadata. Server-component-only export (this file has no `"use client"`
// directive); the interactive bits live in `PricingPageContent`.
export const metadata: Metadata = {
  title: "Pricing — Light Role",
  description:
    "Choose the plan that fits your job search. Free, Pro, or Unlimited — cancel anytime.",
  keywords: [
    "job search",
    "AI resume",
    "cover letter",
    "Light Role pricing",
    "career tools",
  ],
  openGraph: {
    title: "Pricing — Light Role",
    description:
      "Choose the plan that fits your job search. Free, Pro, or Unlimited — cancel anytime.",
    url: "/pricing",
    type: "website",
  },
  alternates: { canonical: "/pricing" },
};

// JSON-LD Product schema (one entity per paid plan). Values mirror PRD 6.8 —
// Free is omitted on purpose; $0 products add no SEO value. Hardcoded rather
// than fetched from `/api/v1/plans` because App Router metadata can't easily
// await network calls at request time, and the PRD prices are stable.
const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Light Role Pro",
    description:
      "30 resume tailorings + 30 cover letters per cycle, unlimited active jobs, analytics dashboard.",
    offers: [
      {
        "@type": "Offer",
        name: "Pro Monthly",
        price: "9.00",
        priceCurrency: "USD",
        url: "https://lightrole.com/pricing",
        availability: "https://schema.org/InStock",
      },
      {
        "@type": "Offer",
        name: "Pro Annual",
        price: "86.00",
        priceCurrency: "USD",
        url: "https://lightrole.com/pricing",
        availability: "https://schema.org/InStock",
      },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Light Role Unlimited",
    description:
      "Unlimited resume tailorings, cover letters, and active jobs. Plus analytics dashboard.",
    offers: [
      {
        "@type": "Offer",
        name: "Unlimited Monthly",
        price: "23.00",
        priceCurrency: "USD",
        url: "https://lightrole.com/pricing",
        availability: "https://schema.org/InStock",
      },
      {
        "@type": "Offer",
        name: "Unlimited Annual",
        price: "220.00",
        priceCurrency: "USD",
        url: "https://lightrole.com/pricing",
        availability: "https://schema.org/InStock",
      },
    ],
  },
];

export default function PricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PricingPageContent />
    </>
  );
}
