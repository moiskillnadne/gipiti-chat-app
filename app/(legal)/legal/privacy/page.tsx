import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";

export async function generateMetadata() {
  const t = await getTranslations("legal.privacy");
  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
  };
}

export default async function PrivacyPage() {
  const t = await getTranslations("legal.privacy");

  return (
    <div className="flex min-h-dvh w-screen items-start justify-center bg-background py-12 md:py-16">
      <div className="w-full max-w-3xl px-4">
        <h1 className="mb-2 font-bold text-2xl md:text-3xl dark:text-zinc-50">
          {t("title")}
        </h1>
        <p className="mb-8 text-muted-foreground text-sm">
          {t("effectiveDate")}
        </p>

        <div className="space-y-8">
          {/* 1. General Provisions */}
          <section>
            <h2 className="mb-4 border-border border-b pb-2 font-semibold text-lg dark:text-zinc-100">
              {t("sections.general.title")}
            </h2>
            <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>{t("sections.general.p1")}</p>
              <p>{t("sections.general.p2")}</p>
              <p>{t("sections.general.p3")}</p>
            </div>
          </section>

          {/* 2. Data Controller */}
          <section>
            <h2 className="mb-4 border-border border-b pb-2 font-semibold text-lg dark:text-zinc-100">
              {t("sections.controller.title")}
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
                <dt className="font-medium text-muted-foreground">
                  {t("sections.controller.name")}
                </dt>
                <dd className="sm:col-span-2">
                  {t("sections.controller.nameValue")}
                </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
                <dt className="font-medium text-muted-foreground">
                  {t("sections.controller.inn")}
                </dt>
                <dd className="sm:col-span-2">
                  {t("sections.controller.innValue")}
                </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
                <dt className="font-medium text-muted-foreground">
                  {t("sections.controller.address")}
                </dt>
                <dd className="sm:col-span-2">
                  {t("sections.controller.addressValue")}
                </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
                <dt className="font-medium text-muted-foreground">
                  {t("sections.controller.email")}
                </dt>
                <dd className="sm:col-span-2">
                  <a
                    className="text-blue-600 hover:underline dark:text-blue-400"
                    href={`mailto:${t("sections.controller.emailValue")}`}
                  >
                    {t("sections.controller.emailValue")}
                  </a>
                </dd>
              </div>
            </dl>
          </section>

          {/* 3. Data Collected */}
          <section>
            <h2 className="mb-4 border-border border-b pb-2 font-semibold text-lg dark:text-zinc-100">
              {t("sections.dataCollected.title")}
            </h2>
            <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>{t("sections.dataCollected.intro")}</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>{t("sections.dataCollected.d1")}</li>
                <li>{t("sections.dataCollected.d2")}</li>
                <li>{t("sections.dataCollected.d3")}</li>
                <li>{t("sections.dataCollected.d4")}</li>
                <li>{t("sections.dataCollected.d5")}</li>
              </ul>
            </div>
          </section>

          {/* 4. Purpose of Processing */}
          <section>
            <h2 className="mb-4 border-border border-b pb-2 font-semibold text-lg dark:text-zinc-100">
              {t("sections.purpose.title")}
            </h2>
            <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>{t("sections.purpose.intro")}</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>{t("sections.purpose.p1")}</li>
                <li>{t("sections.purpose.p2")}</li>
                <li>{t("sections.purpose.p3")}</li>
                <li>{t("sections.purpose.p4")}</li>
                <li>{t("sections.purpose.p5")}</li>
              </ul>
            </div>
          </section>

          {/* 5. Legal Basis */}
          <section>
            <h2 className="mb-4 border-border border-b pb-2 font-semibold text-lg dark:text-zinc-100">
              {t("sections.legalBasis.title")}
            </h2>
            <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>{t("sections.legalBasis.p1")}</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>{t("sections.legalBasis.b1")}</li>
                <li>{t("sections.legalBasis.b2")}</li>
                <li>{t("sections.legalBasis.b3")}</li>
              </ul>
            </div>
          </section>

          {/* 6. Third Party Disclosure */}
          <section>
            <h2 className="mb-4 border-border border-b pb-2 font-semibold text-lg dark:text-zinc-100">
              {t("sections.thirdParty.title")}
            </h2>
            <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>{t("sections.thirdParty.p1")}</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>{t("sections.thirdParty.t1")}</li>
                <li>{t("sections.thirdParty.t2")}</li>
                <li>{t("sections.thirdParty.t3")}</li>
              </ul>
              <p>{t("sections.thirdParty.p2")}</p>
            </div>
          </section>

          {/* 7. User Rights */}
          <section>
            <h2 className="mb-4 border-border border-b pb-2 font-semibold text-lg dark:text-zinc-100">
              {t("sections.userRights.title")}
            </h2>
            <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>{t("sections.userRights.intro")}</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>{t("sections.userRights.r1")}</li>
                <li>{t("sections.userRights.r2")}</li>
                <li>{t("sections.userRights.r3")}</li>
                <li>{t("sections.userRights.r4")}</li>
                <li>{t("sections.userRights.r5")}</li>
              </ul>
              <p>{t("sections.userRights.contact")}</p>
            </div>
          </section>

          {/* 8. Data Security */}
          <section>
            <h2 className="mb-4 border-border border-b pb-2 font-semibold text-lg dark:text-zinc-100">
              {t("sections.security.title")}
            </h2>
            <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>{t("sections.security.p1")}</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>{t("sections.security.s1")}</li>
                <li>{t("sections.security.s2")}</li>
                <li>{t("sections.security.s3")}</li>
                <li>{t("sections.security.s4")}</li>
              </ul>
            </div>
          </section>

          {/* 9. Cookies */}
          <section>
            <h2 className="mb-4 border-border border-b pb-2 font-semibold text-lg dark:text-zinc-100">
              {t("sections.cookies.title")}
            </h2>
            <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>{t("sections.cookies.p1")}</p>
              <p>{t("sections.cookies.p2")}</p>
            </div>
          </section>

          {/* 10. Data Retention */}
          <section>
            <h2 className="mb-4 border-border border-b pb-2 font-semibold text-lg dark:text-zinc-100">
              {t("sections.retention.title")}
            </h2>
            <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>{t("sections.retention.p1")}</p>
              <p>{t("sections.retention.p2")}</p>
            </div>
          </section>

          {/* 11. Policy Changes */}
          <section>
            <h2 className="mb-4 border-border border-b pb-2 font-semibold text-lg dark:text-zinc-100">
              {t("sections.changes.title")}
            </h2>
            <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>{t("sections.changes.p1")}</p>
              <p>{t("sections.changes.p2")}</p>
            </div>
          </section>
        </div>
      </div>

      <div className="fixed bottom-4 left-4 z-50">
        <LanguageSwitcher />
      </div>
    </div>
  );
}
