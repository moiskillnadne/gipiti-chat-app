"use client";

import { useTranslations } from "next-intl";
import { useProject } from "@/contexts/project-context";
import type { Project } from "@/lib/db/schema";

import { EntityManager, type EntityManagerLabels } from "./entity-manager";
import { FolderIcon } from "./icons";

const getItemCount = (project: Project): number =>
  project.contextEntries.length;

export function ProjectManager() {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");
  const { projects, refreshProjects, isLoading } = useProject();

  const labels: EntityManagerLabels = {
    title: t("title"),
    pageDescription: t("pageDescription"),
    createEntity: t("createProject"),
    entityName: t("projectName"),
    namePlaceholder: t("projectNamePlaceholder"),
    defaultBadge: t("defaultBadge"),
    itemCount: (count) => t("contextEntryCount", { count }),
    noEntitiesYet: t("noProjectsYet"),
    noEntitiesDescription: t("noProjectsDescription"),
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
        apiEndpoint: "/api/projects",
        detailRoute: (id) => `/projects/${id}`,
        entities: projects,
        isLoading,
        refreshEntities: refreshProjects,
        getItemCount,
        emptyIcon: <FolderIcon size={48} />,
      }}
      labels={labels}
    />
  );
}
