import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";

export async function generateMetadata() {
  const t = await getTranslations("legal.support");
  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
  };
}

export default async function SupportPage() {
  const t = await getTranslations("legal.support");
  const tCommon = await getTranslations("common.buttons");

  return (
    <div className="flex min-h-dvh w-screen items-start justify-center bg-background py-12 md:py-16">
      <div className="w-full max-w-xl px-4">
        <div className="mb-4">
          <Link href="/chat">
            <Button className="gap-2" variant="ghost">
              <ChevronLeftIcon size={16} />
              {tCommon("back")}
            </Button>
          </Link>
        </div>
        <h1 className="mb-4 font-bold text-2xl md:text-3xl dark:text-zinc-50">
          {t("title")}
        </h1>
        <p className="mb-8 text-muted-foreground leading-relaxed">
          {t("description")}
        </p>

        <div className="rounded-lg border border-border bg-muted/30 p-6">
          <h2 className="mb-3 font-semibold text-lg dark:text-zinc-100">
            {t("contactTitle")}
          </h2>
          <p className="mb-4 text-muted-foreground text-sm">
            {t("contactDescription")}
          </p>
          <a
            className="inline-flex items-center gap-2 font-medium text-blue-600 hover:underline dark:text-blue-400"
            href={`mailto:${t("email")}`}
          >
            <svg
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect height="16" rx="2" width="20" x="2" y="4" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
            {t("email")}
          </a>
        </div>
      </div>

      <div className="fixed bottom-4 left-4 z-50">
        <LanguageSwitcher />
      </div>
    </div>
  );
}
