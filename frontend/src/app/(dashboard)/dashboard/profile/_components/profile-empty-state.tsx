"use client";

import { useTranslations } from "next-intl";
import { FilePen, UploadCloud } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReuploadDropzone } from "../reupload/_components/reupload-dropzone";

interface ProfileEmptyStateProps {
  /**
   * Called when the user picks "Or fill out manually". The shell flips a
   * local `forceTabs` flag so the regular tabs render — no backend write
   * needed (the `user_profiles` row already exists from auto-create on GET).
   */
  onContinueManually: () => void;
}

export function ProfileEmptyState({ onContinueManually }: ProfileEmptyStateProps) {
  const t = useTranslations("profile.emptyState");

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-xl font-semibold tracking-tight">{t("title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Upload card */}
        <Card className="flex h-full flex-col">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-primary" aria-hidden="true" />
              <CardTitle className="text-lg">{t("uploadCard.title")}</CardTitle>
            </div>
            <CardDescription>{t("uploadCard.description")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <ReuploadDropzone
              successToastKey="profile.emptyState.successToast"
              onSuccess={() => {
                /* Cache invalidation in useResetProfile auto-flips
                   isProfileEmpty(), which dismisses the empty state. */
              }}
            />
          </CardContent>
        </Card>

        {/* Manual card */}
        <Card className="flex h-full flex-col">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FilePen className="h-5 w-5 text-primary" aria-hidden="true" />
              <CardTitle className="text-lg">{t("manualCard.title")}</CardTitle>
            </div>
            <CardDescription>{t("manualCard.description")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col items-center justify-center gap-4 py-12 text-center">
            <FilePen className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <Button onClick={onContinueManually} className="w-full sm:w-auto">
              {t("manualCard.button")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
