import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ReuploadDropzone } from "./_components/reupload-dropzone";

export default async function ProfileReuploadPage() {
  const t = await getTranslations("profile.reupload");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/dashboard/profile"
        className="inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {t("backLink")}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <ReuploadDropzone />
    </div>
  );
}
