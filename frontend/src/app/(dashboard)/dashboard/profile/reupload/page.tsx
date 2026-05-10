import { getTranslations } from "next-intl/server";
import {
  AlertTriangle,
  FileText,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { ReuploadDropzone } from "./_components/reupload-dropzone";

export default async function ProfileReuploadPage() {
  const t = await getTranslations("profile.reupload");

  const steps = [
    {
      icon: UploadCloud,
      title: t("steps.step1Title"),
      description: t("steps.step1Description"),
    },
    {
      icon: Sparkles,
      title: t("steps.step2Title"),
      description: t("steps.step2Description"),
    },
    {
      icon: FileText,
      title: t("steps.step3Title"),
      description: t("steps.step3Description"),
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div
          aria-hidden="true"
          className="hidden size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50 sm:flex"
        >
          <UploadCloud className="size-6 text-primary" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            {t("subtitle")}
          </p>
        </div>
      </div>

      {/* Destructive-action warning */}
      <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400">
        <AlertTriangle className="size-4" />
        <AlertTitle className="font-semibold">
          {t("warning.title")}
        </AlertTitle>
        <AlertDescription className="text-amber-800/90 dark:text-amber-100/80">
          {t("warning.description")}
        </AlertDescription>
      </Alert>

      {/* Dropzone */}
      <ReuploadDropzone />

      {/* Steps panel */}
      <section
        aria-labelledby="reupload-steps-heading"
        className="rounded-xl border border-border bg-card p-6"
      >
        <h2
          id="reupload-steps-heading"
          className="text-sm font-semibold tracking-tight text-foreground"
        >
          {t("steps.title")}
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="relative flex gap-3 rounded-lg border border-border/60 bg-background/40 p-4"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p className="text-sm font-medium text-foreground">
                      {step.title}
                    </p>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
