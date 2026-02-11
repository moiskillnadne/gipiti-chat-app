"use client";

import { useTranslations } from "next-intl";
import { useProject } from "@/contexts/project-context";
import type { Project } from "@/lib/db/schema";

import { EntityDetail, type EntityDetailLabels } from "./entity-detail";

const MAX_CONTEXT_ENTRIES = 20;
const MAX_CONTEXT_ENTRY_LENGTH = 2000;

const getItems = (project: Project): string[] => project.contextEntries;
const buildItemsPatch = (items: string[]): Record<string, string[]> => ({
  contextEntries: items,
});

export function ProjectDetail({ initialProject }: { initialProject: Project }) {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");
  const { refreshProjects } = useProject();

  const labels: EntityDetailLabels = {
    title: (name) => t("projectTitle", { name }),
    editName: t("editName"),
    saveError: t("saveError"),
    renameSuccess: t("renameSuccess"),
    itemSaved: t("contextEntrySaved"),
    itemDeleted: t("contextEntryDeleted"),
    deleteSuccess: t("deleteSuccess"),
    deleteError: t("deleteError"),
    setAsDefault: t("setAsDefault"),
    itemsHeader: t("contextEntries"),
    addItem: t("addContextEntry"),
    noItemsYet: t("noContextEntriesYet"),
    noItemsDescription: t("noContextEntriesDescription"),
    itemPlaceholder: t("contextEntryPlaceholder"),
    editItem: t("editContextEntry"),
    deleteItem: t("deleteContextEntry"),
    deleteItemConfirm: t("deleteContextEntryConfirm"),
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
        apiEndpoint: "/api/projects",
        listRoute: "/projects",
        maxItems: MAX_CONTEXT_ENTRIES,
        maxItemLength: MAX_CONTEXT_ENTRY_LENGTH,
        getItems,
        buildItemsPatch,
        refreshEntities: refreshProjects,
      }}
      initialEntity={initialProject}
      labels={labels}
    />
  );
}
