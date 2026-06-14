import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lightrole.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Create your Light Role account",
  description:
    "Sign up free to tailor your resume with AI, draft cover letters, and organize your job search in one place.",
  alternates: {
    canonical: "/auth/register",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Create your Light Role account",
    description:
      "Sign up free to tailor your resume with AI, draft cover letters, and organize your job search in one place.",
    url: "/auth/register",
    type: "website",
    siteName: "Light Role",
  },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
