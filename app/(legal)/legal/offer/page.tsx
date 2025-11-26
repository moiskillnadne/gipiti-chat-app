import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";

export async function generateMetadata() {
  const t = await getTranslations("legal.offer");
  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
  };
}

export default async function OfferPage() {
  const t = await getTranslations("legal.offer");

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

          {/* 2. Definitions */}
          <section>
            <h2 className="mb-4 border-border border-b pb-2 font-semibold text-lg dark:text-zinc-100">
              {t("sections.definitions.title")}
            </h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="font-medium dark:text-zinc-200">
                  {t("sections.definitions.service.term")}
                </dt>
                <dd className="text-muted-foreground">
                  {t("sections.definitions.service.def")}
                </dd>
              </div>
              <div>
                <dt className="font-medium dark:text-zinc-200">
                  {t("sections.definitions.user.term")}
                </dt>
                <dd className="text-muted-foreground">
                  {t("sections.definitions.user.def")}
                </dd>
              </div>
              <div>
                <dt className="font-medium dark:text-zinc-200">
                  {t("sections.definitions.subscription.term")}
                </dt>
                <dd className="text-muted-foreground">
                  {t("sections.definitions.subscription.def")}
                </dd>
              </div>
              <div>
                <dt className="font-medium dark:text-zinc-200">
                  {t("sections.definitions.executor.term")}
                </dt>
                <dd className="text-muted-foreground">
                  {t("sections.definitions.executor.def")}
                </dd>
              </div>
            </dl>
          </section>

          {/* 3. Subject of Agreement */}
          <section>
            <h2 className="mb-4 border-border border-b pb-2 font-semibold text-lg dark:text-zinc-100">
              {t("sections.subject.title")}
            </h2>
            <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>{t("sections.subject.p1")}</p>
              <p>{t("sections.subject.p2")}</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>{t("sections.subject.features.f1")}</li>
                <li>{t("sections.subject.features.f2")}</li>
                <li>{t("sections.subject.features.f3")}</li>
                <li>{t("sections.subject.features.f4")}</li>
              </ul>
            </div>
          </section>

          {/* 4. Order of Acceptance */}
          <section>
            <h2 className="mb-4 border-border border-b pb-2 font-semibold text-lg dark:text-zinc-100">
              {t("sections.acceptance.title")}
            </h2>
            <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>{t("sections.acceptance.p1")}</p>
              <p>{t("sections.acceptance.p2")}</p>
              <p>{t("sections.acceptance.p3")}</p>
            </div>
          </section>

          {/* 5. Cost and Payment */}
          <section>
            <h2 className="mb-4 border-border border-b pb-2 font-semibold text-lg dark:text-zinc-100">
              {t("sections.payment.title")}
            </h2>
            <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>{t("sections.payment.p1")}</p>
              <p>{t("sections.payment.p2")}</p>
              <p>{t("sections.payment.p3")}</p>
              <p>{t("sections.payment.p4")}</p>
            </div>
          </section>

          {/* 6. Rights and Obligations */}
          <section>
            <h2 className="mb-4 border-border border-b pb-2 font-semibold text-lg dark:text-zinc-100">
              {t("sections.rights.title")}
            </h2>
            <div className="space-y-4 text-sm leading-relaxed">
              <div>
                <h3 className="mb-2 font-medium dark:text-zinc-200">
                  {t("sections.rights.executor.title")}
                </h3>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>{t("sections.rights.executor.r1")}</li>
                  <li>{t("sections.rights.executor.r2")}</li>
                  <li>{t("sections.rights.executor.r3")}</li>
                  <li>{t("sections.rights.executor.r4")}</li>
                </ul>
              </div>
              <div>
                <h3 className="mb-2 font-medium dark:text-zinc-200">
                  {t("sections.rights.user.title")}
                </h3>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>{t("sections.rights.user.r1")}</li>
                  <li>{t("sections.rights.user.r2")}</li>
                  <li>{t("sections.rights.user.r3")}</li>
                  <li>{t("sections.rights.user.r4")}</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 7. Liability */}
          <section>
            <h2 className="mb-4 border-border border-b pb-2 font-semibold text-lg dark:text-zinc-100">
              {t("sections.liability.title")}
            </h2>
            <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>{t("sections.liability.p1")}</p>
              <p>{t("sections.liability.p2")}</p>
              <p>{t("sections.liability.p3")}</p>
              <p>{t("sections.liability.p4")}</p>
            </div>
          </section>

          {/* 8. Term and Termination */}
          <section>
            <h2 className="mb-4 border-border border-b pb-2 font-semibold text-lg dark:text-zinc-100">
              {t("sections.termination.title")}
            </h2>
            <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>{t("sections.termination.p1")}</p>
              <p>{t("sections.termination.p2")}</p>
              <p>{t("sections.termination.p3")}</p>
            </div>
          </section>

          {/* 9. Dispute Resolution */}
          <section>
            <h2 className="mb-4 border-border border-b pb-2 font-semibold text-lg dark:text-zinc-100">
              {t("sections.disputes.title")}
            </h2>
            <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>{t("sections.disputes.p1")}</p>
              <p>{t("sections.disputes.p2")}</p>
            </div>
          </section>

          {/* 10. Final Provisions */}
          <section>
            <h2 className="mb-4 border-border border-b pb-2 font-semibold text-lg dark:text-zinc-100">
              {t("sections.final.title")}
            </h2>
            <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>{t("sections.final.p1")}</p>
              <p>{t("sections.final.p2")}</p>
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
