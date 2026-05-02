"use client";

import { useStyle } from "@/contexts/style-context";
import type { TextStyle } from "@/lib/db/schema";
import { useTranslations } from "@/lib/i18n/translate";
import { STYLE_TEMPLATES } from "@/lib/styles-projects/templates";

import {
  EntityGallery,
  type EntityGalleryLabels,
  type GalleryTemplate,
} from "./entity-gallery";

const getItemCount = (style: TextStyle): number => style.examples.length;
const getPreview = (style: TextStyle): string | undefined => style.examples[0];

const TEMPLATES: readonly GalleryTemplate[] = STYLE_TEMPLATES.map(
  (template) => ({
    id: template.id,
    nameKey: template.nameKey,
    previewKey: template.previewKey,
    payload: { examples: template.examples },
  })
);

export function StyleManager() {
  const t = useTranslations("textStyles");
  const tCommon = useTranslations("common");
  const { styles, refreshStyles, isLoading } = useStyle();

  const labels: EntityGalleryLabels = {
    title: t("title"),
    headlineEm: t("headlineEm"),
    description: t("pageDescription"),
    eyebrow: ({ count, tplCount }) =>
      t("eyebrow", { count, tplCount: tplCount.toString() }),
    importLabel: t("import"),
    createCta: t("createStyle"),
    yourEntities: t("yourStyles"),
    newCardLabel: t("newStyle"),
    newCardHint: t("newStyleHint"),
    searchPlaceholder: t("searchPlaceholder"),
    filterAll: t("filterAll"),
    filterPinned: t("filterPinned"),
    filterRecent: t("filterRecent"),
    sortBy: t("sortBy"),
    sortByUses: t("sortByUses"),
    sortByName: t("sortByName"),
    sortByDate: t("sortByDate"),
    usesLabel: t("usesLabel"),
    itemCount: (count) => t("exampleCount", { count }),
    defaultBadge: t("defaultBadge"),
    templatesHeading: t("templatesHeading"),
    templatesHint: t("templatesHint"),
    emptyFilteredTitle: t("emptyFilteredTitle"),
    emptyFilteredDescription: t("emptyFilteredDescription"),
    pin: t("pin"),
    unpin: t("unpin"),
    saveError: t("saveError"),
    deleteSuccess: t("deleteSuccess"),
    deleteError: t("deleteError"),
    deleteConfirmTitle: t("deleteConfirmTitle"),
    deleteConfirmDescription: (name) => t("deleteConfirmDescription", { name }),
    cancel: tCommon("buttons.cancel"),
    save: tCommon("buttons.save"),
    delete: tCommon("buttons.delete"),
    entityName: t("styleName"),
    namePlaceholder: t("styleNamePlaceholder"),
  };

  return (
    <EntityGallery
      config={{
        kind: "style",
        apiEndpoint: "/api/text-styles",
        detailRoute: (id) => `/styles/${id}`,
        entities: styles,
        isLoading,
        refreshEntities: refreshStyles,
        getPreview,
        getItemCount,
        templates: TEMPLATES,
        templateNamespace: "textStyles",
      }}
      labels={labels}
    />
  );
}
