"use client";

import { useProject } from "@/contexts/project-context";
import type { Project } from "@/lib/db/schema";
import { useTranslations } from "@/lib/i18n/translate";
import { PROJECT_TEMPLATES } from "@/lib/styles-projects/templates";

import {
  EntityGallery,
  type EntityGalleryLabels,
  type GalleryTemplate,
} from "./entity-gallery";

const getItemCount = (project: Project): number =>
  project.contextEntries.length;
const getPreview = (project: Project): string | undefined =>
  project.contextEntries[0];

const TEMPLATES: readonly GalleryTemplate[] = PROJECT_TEMPLATES.map(
  (template) => ({
    id: template.id,
    nameKey: template.nameKey,
    previewKey: template.previewKey,
    payload: { contextEntries: template.contextEntries },
  })
);

export function ProjectManager() {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");
  const { projects, refreshProjects, isLoading } = useProject();

  const labels: EntityGalleryLabels = {
    title: t("title"),
    headlineEm: t("headlineEm"),
    description: t("pageDescription"),
    eyebrow: ({ count, tplCount }) =>
      t("eyebrow", { count, tplCount: tplCount.toString() }),
    importLabel: t("import"),
    createCta: t("createProject"),
    yourEntities: t("yourProjects"),
    newCardLabel: t("newProject"),
    newCardHint: t("newProjectHint"),
    searchPlaceholder: t("searchPlaceholder"),
    filterAll: t("filterAll"),
    filterPinned: t("filterPinned"),
    filterRecent: t("filterRecent"),
    sortBy: t("sortBy"),
    sortByUses: t("sortByUses"),
    sortByName: t("sortByName"),
    sortByDate: t("sortByDate"),
    usesLabel: t("usesLabel"),
    itemCount: (count) => t("contextEntryCount", { count }),
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
    entityName: t("projectName"),
    namePlaceholder: t("projectNamePlaceholder"),
  };

  return (
    <EntityGallery
      config={{
        kind: "project",
        apiEndpoint: "/api/projects",
        detailRoute: (id) => `/projects/${id}`,
        entities: projects,
        isLoading,
        refreshEntities: refreshProjects,
        getPreview,
        getItemCount,
        templates: TEMPLATES,
        templateNamespace: "projects",
      }}
      labels={labels}
    />
  );
}
