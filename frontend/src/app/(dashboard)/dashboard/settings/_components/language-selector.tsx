"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setLocale } from "@/i18n/actions";
import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from "@/i18n/locales";

export function LanguageSelector() {
  const t = useTranslations("settings.account.language");
  const currentLocale = useLocale() as Locale;
  const router = useRouter();
  const [value, setValue] = useState<Locale>(currentLocale);
  const [isPending, startTransition] = useTransition();

  const handleChange = (next: string) => {
    if (next === value) return;
    const previous = value;
    setValue(next as Locale);

    startTransition(async () => {
      try {
        const result = await setLocale(next);
        if (!result.ok) {
          setValue(previous);
          toast.error(t("errorToast"));
          return;
        }
        toast.success(t("savedToast"));
        router.refresh();
      } catch {
        setValue(previous);
        toast.error(t("errorToast"));
      }
    });
  };

  return (
    <div className="space-y-1.5">
      <label htmlFor="language-selector" className="text-sm font-medium">
        {t("label")}
      </label>
      <Select value={value} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger id="language-selector" className="w-full sm:w-72">
          <SelectValue placeholder={t("placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LOCALES.map((code) => (
            <SelectItem key={code} value={code}>
              {LOCALE_LABELS[code]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-muted-foreground text-xs">{t("helperText")}</p>
    </div>
  );
}
