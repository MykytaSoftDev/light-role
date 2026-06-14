import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lightrole.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Log in to Light Role",
  description:
    "Sign in to your Light Role account to tailor resumes, generate cover letters, and track your job applications.",
  alternates: {
    canonical: "/auth/login",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Log in to Light Role",
    description:
      "Sign in to your Light Role account to tailor resumes, generate cover letters, and track your job applications.",
    url: "/auth/login",
    type: "website",
    siteName: "Light Role",
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
