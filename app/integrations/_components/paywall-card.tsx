import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { getTranslations } from "@/lib/i18n/translate";

export async function PaywallCard() {
  const t = await getTranslations("integrations.page.paywall");

  return (
    <section className="rounded-lg border border-rule bg-card p-6">
      <h2 className="font-medium text-ink text-lg">{t("title")}</h2>
      <p className="mt-2 mb-5 text-ink-3 text-sm">{t("description")}</p>
      <Link
        className={buttonVariants({ variant: "citrus" })}
        href="/subscription/manage"
      >
        {t("cta")}
      </Link>
    </section>
  );
}
