import { notFound, redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { AccountPageTopNav } from "@/components/account-page-top-nav";
import { listIntegrationsForUser } from "@/lib/db/query/integration/list-for-user";
import { isIntegrationsEnabled } from "@/lib/flags";
import { getTranslations } from "@/lib/i18n/translate";
import { isFreeUserById } from "@/lib/subscription/is-free-user";
import { CatalogGrid } from "./_components/catalog-grid";
import { PaywallCard } from "./_components/paywall-card";

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  if (!(await isIntegrationsEnabled())) {
    notFound();
  }

  const userId = session.user.id;
  const [t, isFree] = await Promise.all([
    getTranslations("integrations.page"),
    isFreeUserById(userId),
  ]);
  const connections = isFree ? [] : await listIntegrationsForUser({ userId });

  return (
    <>
      <AccountPageTopNav currentLabelKey="integrations" />
      <main className="mx-auto w-full max-w-4xl px-10 py-10 max-md:px-5">
        <h1 className="font-semibold text-2xl text-ink">{t("title")}</h1>
        <p className="mt-2 mb-8 text-ink-3 text-sm">{t("subtitle")}</p>
        {isFree ? (
          <PaywallCard />
        ) : (
          <CatalogGrid
            connections={connections.map((connection) => ({
              id: connection.id,
              provider: connection.provider,
              status: connection.status,
              toolCount: connection.toolSnapshot.length,
              toolTokenEstimate: connection.toolTokenEstimate,
            }))}
          />
        )}
      </main>
    </>
  );
}
