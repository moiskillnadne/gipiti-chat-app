"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useTransition } from "react";
import { setUserLocale } from "@/app/actions/locale";
import { toast } from "@/components/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Locale, localeFlags, localeNames, locales } from "@/i18n/config";

export function LanguageSwitcher() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const currentLocale = useLocale() as Locale;

  const handleLocaleChange = (newLocale: string) => {
    const locale = newLocale as Locale;

    startTransition(async () => {
      try {
        const result = await setUserLocale(locale);

        if (!result.success) {
          toast({
            type: "error",
            description: result.error || "Failed to change language",
          });
          return;
        }

        router.refresh();
      } catch (error) {
        console.error("Failed to change locale:", error);
        toast({
          type: "error",
          description: "Failed to change language",
        });
      }
    });
  };

  return (
    <Select
      disabled={isPending}
      onValueChange={handleLocaleChange}
      value={currentLocale}
    >
      <SelectTrigger className="w-[160px]">
        <SelectValue>
          <span className="flex items-center gap-2">
            <span>{localeFlags[currentLocale]}</span>
            <span>{localeNames[currentLocale]}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {locales.map((locale) => (
          <SelectItem key={locale} value={locale}>
            <span className="flex items-center gap-2">
              <span>{localeFlags[locale]}</span>
              <span>{localeNames[locale]}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
