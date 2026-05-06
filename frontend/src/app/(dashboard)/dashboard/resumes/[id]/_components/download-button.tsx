"use client";

/**
 * TAILOR-8 — Download PDF button.
 *
 * Calls POST /api/v1/tailored-resumes/{id}/download (binary stream), wraps
 * the result in an object URL, and triggers a hidden anchor click. Spinner
 * + disabled state during the request; toast on error.
 *
 * Spec: docs/v2/specs/tailor-flow-spec.md §3.6.
 */
import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { downloadTailoredResume } from "@/lib/tailored-resume-api";

export function DownloadButton({ resumeId }: { resumeId: string }) {
  const [isDownloading, setIsDownloading] = React.useState(false);

  async function handleClick() {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const blob = await downloadTailoredResume(resumeId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resume.pdf"; // Server's Content-Disposition wins, but a
      // sane fallback is required for older browsers.
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke after the click stack settles so the navigation has a chance
      // to consume the URL.
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (err) {
      console.error("Download failed", err);
      toast.error("Download failed. Try again.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={isDownloading}
      className="w-full sm:w-auto"
    >
      {isDownloading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Preparing…
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          Download PDF
        </>
      )}
    </Button>
  );
}
