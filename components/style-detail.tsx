"use client";

import { useTranslations } from "next-intl";
import { useStyle } from "@/contexts/style-context";
import type { TextStyle } from "@/lib/db/schema";

import { EntityDetail, type EntityDetailLabels } from "./entity-detail";

const MAX_EXAMPLES = 20;
const MAX_EXAMPLE_LENGTH = 2000;

const getItems = (style: TextStyle): string[] => style.examples;
const buildItemsPatch = (items: string[]): Record<string, string[]> => ({
  examples: items,
});

export function StyleDetail({ initialStyle }: { initialStyle: TextStyle }) {
  const t = useTranslations("textStyles");
  const tCommon = useTranslations("common");
  const { refreshStyles } = useStyle();

  const labels: EntityDetailLabels = {
    title: (name) => t("styleTitle", { name }),
    editName: t("editName"),
    saveError: t("saveError"),
    renameSuccess: t("renameSuccess"),
    itemSaved: t("exampleSaved"),
    itemDeleted: t("exampleDeleted"),
    deleteSuccess: t("deleteSuccess"),
    deleteError: t("deleteError"),
    setAsDefault: t("setAsDefault"),
    itemsHeader: t("examples"),
    addItem: t("addExample"),
    noItemsYet: t("noExamplesYet"),
    noItemsDescription: t("noExamplesDescription"),
    itemPlaceholder: t("examplePlaceholder"),
    editItem: t("editExample"),
    deleteItem: t("deleteExample"),
    deleteItemConfirm: t("deleteExampleConfirm"),
    deleteConfirmTitle: t("deleteConfirmTitle"),
    deleteConfirmDescription: (name) => t("deleteConfirmDescription", { name }),
    back: tCommon("buttons.back"),
    save: tCommon("buttons.save"),
    cancel: tCommon("buttons.cancel"),
    delete: tCommon("buttons.delete"),
  };

  return (
    <EntityDetail
      config={{
        apiEndpoint: "/api/text-styles",
        listRoute: "/styles",
        maxItems: MAX_EXAMPLES,
        maxItemLength: MAX_EXAMPLE_LENGTH,
        getItems,
        buildItemsPatch,
        refreshEntities: refreshStyles,
      }}
      initialEntity={initialStyle}
      labels={labels}
    />
  );
}
