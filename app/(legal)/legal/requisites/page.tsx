import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";

export async function generateMetadata() {
  const t = await getTranslations("legal.requisites");
  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
  };
}

export default async function RequisitesPage() {
  const t = await getTranslations("legal.requisites");

  return (
    <div className="flex min-h-dvh w-screen items-start justify-center bg-background py-12 md:py-16">
      <div className="w-full max-w-2xl px-4">
        <h1 className="mb-8 font-bold text-2xl dark:text-zinc-50 md:text-3xl">
          {t("title")}
        </h1>

        <div className="space-y-8">
          {/* Business Info */}
          <section>
            <h2 className="mb-4 border-b border-border pb-2 font-semibold text-lg dark:text-zinc-100">
              {t("sections.businessInfo")}
            </h2>
            <dl className="space-y-3">
              <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
                <dt className="font-medium text-muted-foreground text-sm">
                  {t("fields.entrepreneur")}
                </dt>
                <dd className="text-sm sm:col-span-2">{t("values.entrepreneur")}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
                <dt className="font-medium text-muted-foreground text-sm">
                  {t("fields.inn")}
                </dt>
                <dd className="text-sm sm:col-span-2">{t("values.inn")}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
                <dt className="font-medium text-muted-foreground text-sm">
                  {t("fields.ogrnip")}
                </dt>
                <dd className="text-sm sm:col-span-2">{t("values.ogrnip")}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
                <dt className="font-medium text-muted-foreground text-sm">
                  {t("fields.registrationDate")}
                </dt>
                <dd className="text-sm sm:col-span-2">{t("values.registrationDate")}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
                <dt className="font-medium text-muted-foreground text-sm">
                  {t("fields.registrar")}
                </dt>
                <dd className="text-sm sm:col-span-2">{t("values.registrar")}</dd>
              </div>
            </dl>
          </section>

          {/* Address */}
          <section>
            <h2 className="mb-4 border-b border-border pb-2 font-semibold text-lg dark:text-zinc-100">
              {t("sections.address")}
            </h2>
            <dl className="space-y-3">
              <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
                <dt className="font-medium text-muted-foreground text-sm">
                  {t("fields.legalAddress")}
                </dt>
                <dd className="text-sm sm:col-span-2">{t("values.legalAddress")}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
                <dt className="font-medium text-muted-foreground text-sm">
                  {t("fields.postalAddress")}
                </dt>
                <dd className="text-sm sm:col-span-2">{t("values.postalAddress")}</dd>
              </div>
            </dl>
          </section>

          {/* Bank Details */}
          <section>
            <h2 className="mb-4 border-b border-border pb-2 font-semibold text-lg dark:text-zinc-100">
              {t("sections.bankDetails")}
            </h2>
            <dl className="space-y-3">
              <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
                <dt className="font-medium text-muted-foreground text-sm">
                  {t("fields.bank")}
                </dt>
                <dd className="text-sm sm:col-span-2">{t("values.bank")}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
                <dt className="font-medium text-muted-foreground text-sm">
                  {t("fields.bik")}
                </dt>
                <dd className="text-sm sm:col-span-2">{t("values.bik")}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
                <dt className="font-medium text-muted-foreground text-sm">
                  {t("fields.accountNumber")}
                </dt>
                <dd className="text-sm sm:col-span-2">{t("values.accountNumber")}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
                <dt className="font-medium text-muted-foreground text-sm">
                  {t("fields.correspondentAccount")}
                </dt>
                <dd className="text-sm sm:col-span-2">{t("values.correspondentAccount")}</dd>
              </div>
            </dl>
          </section>

          {/* Contact Info */}
          <section>
            <h2 className="mb-4 border-b border-border pb-2 font-semibold text-lg dark:text-zinc-100">
              {t("sections.contactInfo")}
            </h2>
            <dl className="space-y-3">
              <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
                <dt className="font-medium text-muted-foreground text-sm">
                  {t("fields.email")}
                </dt>
                <dd className="text-sm sm:col-span-2">
                  <a
                    className="text-blue-600 hover:underline dark:text-blue-400"
                    href={`mailto:${t("values.email")}`}
                  >
                    {t("values.email")}
                  </a>
                </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
                <dt className="font-medium text-muted-foreground text-sm">
                  {t("fields.phone")}
                </dt>
                <dd className="text-sm sm:col-span-2">
                  <a
                    className="text-blue-600 hover:underline dark:text-blue-400"
                    href={`tel:${t("values.phone")}`}
                  >
                    {t("values.phone")}
                  </a>
                </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
                <dt className="font-medium text-muted-foreground text-sm">
                  {t("fields.website")}
                </dt>
                <dd className="text-sm sm:col-span-2">
                  <a
                    className="text-blue-600 hover:underline dark:text-blue-400"
                    href={t("values.website")}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {t("values.website")}
                  </a>
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>

      <div className="fixed bottom-4 left-4 z-50">
        <LanguageSwitcher />
      </div>
    </div>
  );
}

