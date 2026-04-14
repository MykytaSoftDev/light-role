import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/dashboard/settings/account",
        destination: "/dashboard/settings?tab=account",
        permanent: false,
      },
      {
        source: "/dashboard/settings/security",
        destination: "/dashboard/settings?tab=security",
        permanent: false,
      },
      {
        source: "/dashboard/settings/notifications",
        destination: "/dashboard/settings?tab=notifications",
        permanent: false,
      },
    ];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG || "",
  project: process.env.SENTRY_PROJECT || "",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
