import { getTranslations } from "@/lib/i18n/translate";
import { CATALOG } from "@/lib/integrations/catalog";
import {
  IntegrationCard,
  type IntegrationCardConnection,
} from "./integration-card";

export type CatalogGridConnection = IntegrationCardConnection & {
  provider: string;
};

// Only credential-free built-ins can be connected from this page for now.
const CONNECTABLE = CATALOG.filter((entry) => entry.authType === "none");

export async function CatalogGrid({
  connections,
}: {
  connections: CatalogGridConnection[];
}) {
  const t = await getTranslations("integrations.page");

  if (CONNECTABLE.length === 0) {
    return <p className="text-ink-3 text-sm">{t("empty")}</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
      {CONNECTABLE.map((entry) => (
        <li key={entry.id}>
          <IntegrationCard
            catalogId={entry.id}
            connection={connections.find(
              (connection) => connection.provider === entry.id
            )}
          />
        </li>
      ))}
    </ul>
  );
}
