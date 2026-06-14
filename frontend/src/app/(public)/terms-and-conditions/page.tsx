import type { Metadata } from "next";

import { LegalPage, type LegalSection } from "@/components/landing/legal/legal-page";

const metadataBase = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://lightrole.com");

const TITLE = "Light Role Terms & Conditions";
const DESCRIPTION =
  "The terms that govern your use of Light Role: billing, refunds, AI-generated content, acceptable use, and your rights.";

export const metadata: Metadata = {
  metadataBase,
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/terms-and-conditions" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/terms-and-conditions",
    type: "website",
    siteName: "Light Role",
  },
  robots: { index: true, follow: true },
};

const TLDR =
  "· We don't sell your data. We don't train AI on your data. You can export and delete everything anytime. The full text below is what you'd want to read if you were our lawyer. We tried to make it readable for everyone else.";

const SECTIONS: LegalSection[] = [
  {
    id: "acceptance-of-terms",
    title: "Acceptance of terms",
    paragraphs: [
      "These Terms govern your use of Light Role (the “Service”), operated by Light Role (“we”, “us”, “our”). By creating an account or using the Service, you agree to be bound by these Terms.",
      "If you do not agree to any part of these Terms, you may not use the Service. We may update these Terms from time to time; material changes will be notified by email and a banner in-product at least 14 days before they take effect.",
    ],
  },
  {
    id: "your-account",
    title: "Your account",
    paragraphs: [
      "You're responsible for everything that happens under your account. Keep your password secure and notify us immediately if you suspect unauthorized access.",
      "You must be at least 16 to create an account. Accounts may not be shared across multiple people; teams and orgs are a separate plan we may launch later.",
    ],
  },
  {
    id: "subscription-and-billing",
    title: "Subscription and billing",
    paragraphs: [
      "Paid plans are billed in advance, monthly or annually, at your choice. Payments are processed by Paddle, our merchant of record. Prices are listed at lightrole.com/pricing and may be updated with 30 days' notice for existing subscribers.",
      "Annual plans include a 30-day refund window: cancel within 30 days of purchase for a full refund. Monthly plans are non-refundable but you can cancel anytime to stop the next charge.",
      "Failed payments will retry for 7 days. If we can't collect, your account is downgraded to Free (you keep all your data, read-only access continues, AI generation pauses).",
    ],
  },
  {
    id: "ai-generated-content",
    title: "AI-generated content",
    paragraphs: [
      "The Service uses third-party AI models (currently OpenAI) to generate resumes, cover letters, and parsed data. You retain full ownership of all generated content. We do not claim any intellectual property over your outputs.",
      "You are responsible for reviewing AI-generated content before sending it to recruiters or third parties. We do not guarantee accuracy, completeness, or that the content will not, despite our best efforts, occasionally read like AI. Always proofread.",
      "We never use your data to train our models. See our Privacy Policy for details on data handling.",
    ],
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    paragraphs: [
      "You agree not to: (a) use the Service to apply for jobs you have no genuine interest in or intent to perform, (b) misrepresent your qualifications in ways that constitute fraud, (c) scrape or automate the Service in ways not permitted by our API terms, (d) reverse-engineer, decompile, or attempt to extract source code, (e) use the Service in violation of any applicable law.",
      "Violations may result in immediate account termination without refund.",
    ],
  },
  {
    id: "intellectual-property",
    title: "Intellectual property",
    paragraphs: [
      "The Light Role name, logo, and software are owned by Light Role. Your account, your data, your generated content, those remain yours.",
      "You grant us a limited license to process your data solely to operate the Service: storage, AI generation, analytics, and similar. This license terminates when you delete your account.",
    ],
  },
  {
    id: "termination",
    title: "Termination",
    paragraphs: [
      "You can delete your account at any time from Settings → Account. We'll permanently delete your data within 30 days, except where retention is required by law (see Privacy Policy).",
      "We may suspend or terminate your account for material breach of these Terms, suspected fraud, or non-payment after the 7-day grace period.",
    ],
  },
  {
    id: "disclaimer",
    title: "Disclaimer",
    paragraphs: [
      "The Service is provided “as is” without warranties of any kind, express or implied. We don't guarantee you'll get more interviews, land a job, or that AI outputs will be free of errors.",
      "To the maximum extent permitted by law, our total liability for any claim arising from your use of the Service is capped at the amount you paid us in the 12 months preceding the claim.",
    ],
  },
  {
    id: "changes-to-the-service",
    title: "Changes to the Service",
    paragraphs: [
      "We may add, remove, or change features at any time. Material removals affecting paid features will be announced at least 30 days in advance, and you'll have the option to refund the unused portion of your subscription.",
    ],
  },
  {
    id: "governing-law-and-disputes",
    title: "Governing law and disputes",
    paragraphs: [
      "These Terms are governed by the laws of Delaware, USA. Disputes will first be addressed through good-faith negotiation; if unresolved, they will be settled by binding arbitration under the AAA commercial rules in Wilmington, DE.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    paragraphs: [
      "Questions about these Terms? Email us at legal@lightrole.com. We answer every email, usually within two business days.",
    ],
  },
];

export default function TermsAndConditionsPage() {
  return (
    <LegalPage
      title={"Terms &\nConditions"}
      lastUpdated="June 10, 2026"
      tldr={TLDR}
      sections={SECTIONS}
    />
  );
}
