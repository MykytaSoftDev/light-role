"use client";

// TODO(TAILOR-15): remove the entire /dashboard/resumes/dev/* tree once the
// real /dashboard/resumes list page lands.
//
// Short-lived QA harness for TAILOR-4 / TAILOR-5. Renders the
// `<ResumePreview>` with three canned sample resumes (1-page, 2-page boundary,
// 3-page) plus a font selector and a section-order picker. Hardcoded data;
// no API. Folder name is `dev/` (vs. the spec's `_dev/`) because Next.js App
// Router treats `_`-prefixed folders as private and excludes them from
// routing, which would make this QA route unreachable.

import * as React from "react";

import { ResumePreview } from "@/components/resume/resume-preview";
import {
  RESUME_FONTS,
  type ResumeFont,
} from "@/lib/fonts/resume-fonts";
import type { ProfileData } from "@/lib/profile-api";

// ---------------------------------------------------------------------------
// Section orderings — quick drop-down options (drag-drop UI is out of scope)
// ---------------------------------------------------------------------------

const ORDER_DEFAULT = [
  "summary",
  "employment",
  "education",
  "skills",
  "languages",
  "projects",
  "certificates",
  "achievements",
  "volunteer",
];

const ORDER_PROJECTS_FIRST = [
  "summary",
  "projects",
  "employment",
  "skills",
  "education",
  "certificates",
  "languages",
  "achievements",
  "volunteer",
];

const ORDER_NO_SUMMARY = [
  "employment",
  "education",
  "skills",
  "languages",
  "projects",
  "certificates",
  "achievements",
  "volunteer",
];

const ORDER_OPTIONS: Record<string, string[]> = {
  "Default (PRD order)": ORDER_DEFAULT,
  "Projects-first": ORDER_PROJECTS_FIRST,
  "Without Summary": ORDER_NO_SUMMARY,
};

// ---------------------------------------------------------------------------
// Sample data — exercises every section, plus 3 lengths
// ---------------------------------------------------------------------------

const SAMPLE_BASE: ProfileData = {
  personal_info: {
    full_name: "Jane Q. Applicant",
    email: "jane@example.com",
    phone: "+1 (555) 010-0100",
    location: "San Francisco, CA",
    social_links: [
      { platform: "linkedin", url: "https://linkedin.com/in/janeapplicant" },
      { platform: "github", url: "https://github.com/janeapplicant" },
      { platform: "website", url: "https://janeapplicant.dev" },
    ],
  },
  summary:
    "<p>Senior backend engineer with 8 years of experience scaling distributed systems in fintech. Led the migration of a monolith to microservices serving 12M MAU and shipped event-sourcing pipelines handling 2B events/day.</p>",
  employment: [
    {
      role: "Senior Software Engineer",
      company: "Acme Inc",
      location: "San Francisco, CA",
      start_date: "2022-01",
      end_date: null,
      is_current: true,
      details: [
        "<p>Led migration of monolith to microservices, reducing p95 latency by 40% and unblocking independent team deploys.</p>",
        "<p>Designed and shipped an event-sourcing pipeline handling 2B events/day on Kafka and Postgres.</p>",
        "<p>Mentored 4 junior engineers; ran weekly architecture review sessions and drove RFC-based decisions.</p>",
      ],
    },
    {
      role: "Software Engineer",
      company: "Initech",
      location: "Remote",
      start_date: "2019-06",
      end_date: "2021-12",
      is_current: false,
      details: [
        "<p>Built a billing reconciliation service that recovered <strong>$2.4M</strong> of dropped revenue in its first quarter.</p>",
        "<p>Owned the migration from MySQL to PostgreSQL across 14 services with zero customer-visible downtime.</p>",
      ],
    },
    {
      role: "Junior Software Engineer",
      company: "Hooli",
      location: "Palo Alto, CA",
      start_date: "2017-08",
      end_date: "2019-05",
      is_current: false,
      details: [
        "<p>Shipped 8 production features across the search and recommendations stack.</p>",
        "<p>Co-authored the on-call runbooks now used company-wide.</p>",
      ],
    },
  ],
  education: [
    {
      degree: "B.S. Computer Science",
      institution: "Stanford University",
      field_of_study: "Systems & Networks",
      location: "Stanford, CA",
      start_date: "2013-09",
      end_date: "2017-06",
      is_current: false,
      description:
        "<p>Concentration in distributed systems. Graduated with distinction.</p>",
    },
    {
      degree: "Exchange — Computer Engineering",
      institution: "ETH Zürich",
      field_of_study: null,
      location: "Zürich, CH",
      start_date: "2016-01",
      end_date: "2016-06",
      is_current: false,
      description: null,
    },
  ],
  skills: [
    { name: "TypeScript" },
    { name: "Python" },
    { name: "Go" },
    { name: "PostgreSQL" },
    { name: "Redis" },
    { name: "Docker" },
    { name: "Kubernetes" },
    { name: "AWS" },
    { name: "Terraform" },
    { name: "gRPC" },
    { name: "GraphQL" },
  ],
  projects: [
    {
      name: "Light Role — AI Resume Tailor",
      description:
        "<p>A web platform that helps job seekers tailor resumes to specific roles via an AI pipeline producing ATS-friendly PDFs.</p>",
      role: "Founder",
      start_date: "2024-01",
      end_date: null,
      is_current: true,
      technologies: ["TypeScript", "Next.js", "Python", "FastAPI", "OpenAI"],
      url: "https://lightrole.com",
      repository_url: "https://github.com/example/lightrole",
      details: [
        "<p>Built end-to-end AI tailoring pipeline producing ATS-friendly PDFs.</p>",
        "<p>Designed component-based resume template usable in browser and via Puppeteer.</p>",
      ],
    },
    {
      name: "openschema",
      description:
        "<p>A small CLI for diffing JSON Schema documents — used at Acme to gate breaking-change PRs.</p>",
      role: "Author",
      start_date: "2021-03",
      end_date: "2022-09",
      is_current: false,
      technologies: ["Go", "Cobra"],
      url: null,
      repository_url: "https://github.com/example/openschema",
      details: [],
    },
  ],
  languages: [{ name: "English" }, { name: "Spanish" }, { name: "Mandarin" }],
  certificates: [
    {
      name: "AWS Certified Solutions Architect — Professional",
      issuer: "Amazon Web Services",
      issue_date: "2024-05",
      expiry_date: null,
      credential_url: "https://credly.com/badges/abc-123",
    },
    {
      name: "Certified Kubernetes Administrator",
      issuer: "CNCF",
      issue_date: "2022-02",
      expiry_date: "2025-02",
      credential_url: null,
    },
  ],
  achievements: [
    {
      title: "Top 1% Performer Award",
      description:
        "<p>Recognized for leading the platform migration that reduced infra costs by 35%.</p>",
      date: "2023",
      issuer: "Acme Inc",
    },
    {
      title: "Speaker, KubeCon NA",
      description: "<p>Talk: 'Pragmatic Event Sourcing on Postgres'.</p>",
      date: "2022-10",
      issuer: null,
    },
  ],
  volunteer: [
    {
      role: "Mentor",
      organization: "Code 2040",
      location: "Remote",
      start_date: "2020-01",
      end_date: null,
      is_current: true,
      details: [
        "<p>Mentor 2 fellows per cohort across systems design and interview prep.</p>",
      ],
    },
    {
      role: "Workshop Lead",
      organization: "Hack the Bay",
      location: "San Francisco, CA",
      start_date: "2019-03",
      end_date: "2019-03",
      is_current: false,
      details: [
        "<p>Led a 4-hour intro-to-databases workshop for ~60 first-time hackathon participants.</p>",
      ],
    },
  ],
};

// 1-page sample: short summary, only a couple of bullets total.
const SAMPLE_ONE_PAGE: ProfileData = {
  ...SAMPLE_BASE,
  summary: "<p>Senior backend engineer focused on distributed systems.</p>",
  employment: SAMPLE_BASE.employment.slice(0, 1).map((e) => ({
    ...e,
    details: e.details.slice(0, 1),
  })),
  education: SAMPLE_BASE.education.slice(0, 1),
  projects: SAMPLE_BASE.projects.slice(0, 1).map((p) => ({ ...p, details: [] })),
  certificates: [],
  achievements: [],
  volunteer: [],
  languages: SAMPLE_BASE.languages.slice(0, 2),
  skills: SAMPLE_BASE.skills.slice(0, 5),
};

// 3-page sample: pad employment so content overflows multiple pages.
const SAMPLE_THREE_PAGE: ProfileData = (() => {
  const padded = [
    ...SAMPLE_BASE.employment,
    ...SAMPLE_BASE.employment.map((e) => ({
      ...e,
      role: `${e.role} (II)`,
      details: e.details,
    })),
    ...SAMPLE_BASE.employment.map((e) => ({
      ...e,
      role: `${e.role} (III)`,
      details: e.details,
    })),
  ];
  return { ...SAMPLE_BASE, employment: padded };
})();

const SAMPLES: Record<string, ProfileData> = {
  "1 page (minimal)": SAMPLE_ONE_PAGE,
  "2 pages (boundary)": SAMPLE_BASE,
  "3 pages (long)": SAMPLE_THREE_PAGE,
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PreviewClassicDevPage() {
  const [sampleKey, setSampleKey] = React.useState<keyof typeof SAMPLES>(
    "2 pages (boundary)"
  );
  const [orderKey, setOrderKey] = React.useState<keyof typeof ORDER_OPTIONS>(
    "Default (PRD order)"
  );
  const [font, setFont] = React.useState<ResumeFont>("Inter");
  const [forceEmptySummary, setForceEmptySummary] = React.useState(false);

  const data = React.useMemo(() => {
    const d = SAMPLES[sampleKey];
    return forceEmptySummary ? { ...d, summary: "" } : d;
  }, [sampleKey, forceEmptySummary]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="border-b border-border bg-background sticky top-0 z-10">
        <div className="px-6 py-3 flex flex-wrap items-center gap-3 text-sm">
          <strong>TAILOR-4 dev preview</strong>
          <span className="text-muted-foreground">
            (transient route — remove with TAILOR-15)
          </span>

          <label className="ml-4 flex items-center gap-2">
            Sample:
            <select
              className="border border-border rounded px-2 py-1 bg-background"
              value={sampleKey}
              onChange={(e) => setSampleKey(e.target.value as keyof typeof SAMPLES)}
            >
              {Object.keys(SAMPLES).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            Sections:
            <select
              className="border border-border rounded px-2 py-1 bg-background"
              value={orderKey}
              onChange={(e) =>
                setOrderKey(e.target.value as keyof typeof ORDER_OPTIONS)
              }
            >
              {Object.keys(ORDER_OPTIONS).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            Font:
            <select
              className="border border-border rounded px-2 py-1 bg-background"
              value={font}
              onChange={(e) => setFont(e.target.value as ResumeFont)}
            >
              {RESUME_FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={forceEmptySummary}
              onChange={(e) => setForceEmptySummary(e.target.checked)}
            />
            Force empty summary
          </label>
        </div>
      </div>

      <ResumePreview
        data={data}
        font={font}
        sections_order={ORDER_OPTIONS[orderKey]}
        template="classic"
      />
    </div>
  );
}
