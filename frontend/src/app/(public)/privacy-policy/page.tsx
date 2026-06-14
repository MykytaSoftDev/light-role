import type { Metadata } from "next";

import { LegalPage, type LegalSection } from "@/components/landing/legal/legal-page";

const metadataBase = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://lightrole.com");

const TITLE = "Light Role Privacy Policy";
const DESCRIPTION =
  "What data Light Role collects, how it's used for AI resume tailoring and application tracking, who it's shared with, and your GDPR rights.";

export const metadata: Metadata = {
  metadataBase,
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/privacy-policy" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/privacy-policy",
    type: "website",
    siteName: "Light Role",
  },
  robots: { index: true, follow: true },
};

const TLDR =
  "· We don't sell your data. We don't train AI on your data. You can export and delete everything anytime. The full text below is what you'd want to read if you were our lawyer. We tried to make it readable for everyone else.";

const SECTIONS: LegalSection[] = [
  {
    id: "what-data-we-collect",
    title: "What data we collect",
    paragraphs: [
      "We collect (a) account data: your email, password hash, and name; (b) profile data: everything you put into your Profile, including resume content, skills, and links; (c) job data: job descriptions you save and parse, your application statuses, notes; (d) AI artifacts: the resumes and cover letters we generate for you; (e) usage data: pages visited, actions taken, errors encountered; (f) payment data: handled entirely by our payment processor, we never see your card details.",
    ],
  },
  {
    id: "how-we-use-your-data",
    title: "How we use your data",
    paragraphs: [
      "Your data is used to (a) operate the Service: generate resumes and letters, track applications, display analytics; (b) communicate with you: billing receipts, security alerts, occasional product updates you can opt out of; (c) improve the Service: aggregated, anonymized usage data tells us which features get used and which don't.",
      "We do not sell your data. We do not share it with advertisers. We do not use it to train any AI model, ours or anyone else's.",
    ],
  },
  {
    id: "ai-processing",
    title: "AI processing",
    paragraphs: [
      "We use OpenAI's API to power resume tailoring, cover letter generation, and job-description parsing. When you trigger an AI operation, the relevant data (your profile + the job description) is sent to OpenAI's API endpoints over TLS.",
      "Under OpenAI's API policy: (a) your data is not used to train their models; (b) requests are retained only temporarily for abuse monitoring and then deleted; (c) human reviewers do not see your data outside of strict safety classifications.",
      "We may switch AI providers in the future. Any change will be announced and held to the same data-handling standard.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies and similar technologies",
    paragraphs: [
      "We use first-party cookies for authentication (keeping you logged in) and to remember your preferences (theme, locale). That's it.",
      "We do not use Facebook Pixel, Google Analytics, advertising cookies, or any cross-site tracking.",
    ],
  },
  {
    id: "data-sharing",
    title: "Data sharing",
    paragraphs: [
      "We share data with a small number of vendors that are essential to operating the Service: OpenAI (AI processing), Paddle (payments, our merchant of record), Resend (email delivery), Sentry (error monitoring), Hetzner (hosting, Germany). Each is contractually limited to processing data for the purpose we've engaged them for.",
    ],
  },
  {
    id: "your-rights",
    title: "Your rights (GDPR & similar)",
    paragraphs: [
      "If you're in the EU/UK, EEA, California, or any jurisdiction granting equivalent rights, you have the right to: access your data; correct inaccurate data (you can edit anything in-product); delete your data (Settings → Account → Delete); restrict or object to processing; data portability; withdraw consent for any optional processing.",
      "To exercise these rights, email privacy@lightrole.com or use the in-product controls. We respond to verified requests within 30 days.",
    ],
  },
  {
    id: "data-retention",
    title: "Data retention",
    paragraphs: [
      "Active accounts: we keep your data for as long as the account exists. Deleted accounts: data is purged from production within 30 days. Backups: backups are encrypted and cycle out within 90 days. Legal retention: limited billing records (e.g., invoices) are retained by our merchant of record as required by tax law, typically 7 years.",
    ],
  },
  {
    id: "security",
    title: "Security",
    paragraphs: [
      "All data is encrypted in transit (TLS 1.2+). Passwords are hashed with bcrypt. Access to production systems is restricted to a small number of engineers and is audited.",
      "If a data incident occurs that affects your data, we will notify you within 72 hours of becoming aware of it.",
    ],
  },
  {
    id: "children",
    title: "Children",
    paragraphs: [
      "Light Role is not directed to children under 16. We don't knowingly collect data from anyone under 16. If you become aware that a child under 16 has provided us with personal data, please contact us and we'll delete it.",
    ],
  },
  {
    id: "international-transfers",
    title: "International transfers",
    paragraphs: [
      "Our servers are located in Germany (EU), operated by Hetzner. If you're in the EU/EEA/UK, your data stays in the EU at rest.",
      "Some vendors process data outside the EEA (e.g., OpenAI in the United States). Those transfers are covered by Standard Contractual Clauses (SCCs) and equivalent safeguards under GDPR.",
    ],
  },
  {
    id: "changes-to-this-policy",
    title: "Changes to this policy",
    paragraphs: [
      "We'll notify you of material changes at least 14 days before they take effect, via email and a banner in-product. Continued use of the Service after changes take effect constitutes acceptance of the updated policy.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    paragraphs: [
      "Questions about privacy? Email privacy@lightrole.com. Our data protection officer (DPO) is reachable at dpo@lightrole.com for GDPR-specific inquiries.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="June 10, 2026"
      tldr={TLDR}
      sections={SECTIONS}
    />
  );
}
