"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// NOTE: This file replaces the entire app shell when the root segment errors,
// so it renders its own <html>/<body>. It runs OUTSIDE NextIntlClientProvider,
// so `useTranslations` is not usable here. Keys mirror Errors.global.* in
// en.json and must be kept in sync manually if labels change.
//
// TODO i18n: localize global-error strings via a different mechanism (e.g.
// inline import of messages JSON keyed by request locale cookie). For MVP
// this file ships English-only.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            fontFamily: "sans-serif",
          }}
        >
          <h1 style={{ fontSize: "2rem", fontWeight: "bold" }}>
            Application error
          </h1>
          <p style={{ color: "#666", marginTop: "1rem" }}>
            Something went wrong loading the page.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.5rem 1.5rem",
              background: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
