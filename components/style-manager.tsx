"use client";

import { useTranslations } from "next-intl";
import { useStyle } from "@/contexts/style-context";
import type { TextStyle } from "@/lib/db/schema";

import { EntityManager, type EntityManagerLabels } from "./entity-manager";
import { PenIcon } from "./icons";

const getItemCount = (style: TextStyle): number => style.examples.length;

export function StyleManager() {
  const t = useTranslations("textStyles");
  const tCommon = useTranslations("common");
  const { styles, refreshStyles, isLoading } = useStyle();

  const labels: EntityManagerLabels = {
    title: t("title"),
    pageDescription: t("pageDescription"),
    createEntity: t("createStyle"),
    entityName: t("styleName"),
    namePlaceholder: t("styleNamePlaceholder"),
    defaultBadge: t("defaultBadge"),
    itemCount: (count) => t("exampleCount", { count }),
    noEntitiesYet: t("noStylesYet"),
    noEntitiesDescription: t("noStylesDescription"),
    saveError: t("saveError"),
    deleteSuccess: t("deleteSuccess"),
    deleteError: t("deleteError"),
    deleteConfirmTitle: t("deleteConfirmTitle"),
    deleteConfirmDescription: (name) => t("deleteConfirmDescription", { name }),
    back: tCommon("buttons.back"),
    save: tCommon("buttons.save"),
    cancel: tCommon("buttons.cancel"),
    delete: tCommon("buttons.delete"),
  };

  return (
    <EntityManager
      config={{
        apiEndpoint: "/api/text-styles",
        detailRoute: (id) => `/styles/${id}`,
        entities: styles,
        isLoading,
        refreshEntities: refreshStyles,
        getItemCount,
        emptyIcon: <PenIcon size={48} />,
      }}
      labels={labels}
    />
  );
}
