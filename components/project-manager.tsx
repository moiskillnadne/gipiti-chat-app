"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { useProject } from "@/contexts/project-context";
import type { Project } from "@/lib/db/schema";

import { FolderIcon, TrashIcon } from "./icons";
import { toast } from "./toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const MAX_NAME_LENGTH = 128;

export function ProjectManager() {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { projects, refreshProjects, isLoading } = useProject();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const handleCreate = useCallback(async () => {
    const trimmedName = createName.trim();
    if (!trimmedName || isCreating) {
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });

      if (!response.ok) {
        throw new Error("Failed to create project");
      }

      const newProject = await response.json();
      refreshProjects();
      setIsCreateOpen(false);
      setCreateName("");
      router.push(`/projects/${newProject.id}`);
    } catch {
      toast({ type: "error", description: t("saveError") });
    } finally {
      setIsCreating(false);
    }
  }, [createName, isCreating, refreshProjects, router, t]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      await fetch(`/api/projects?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      toast({ type: "success", description: t("deleteSuccess") });
      refreshProjects();
    } catch {
      toast({ type: "error", description: t("deleteError") });
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, refreshProjects, t]);

  const closeCreate = () => {
    setIsCreateOpen(false);
    setCreateName("");
  };

  return (
    <div className="flex h-dvh flex-col px-4 py-8">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button onClick={() => router.push("/")} size="sm" variant="ghost">
            {tCommon("buttons.back")}
          </Button>
          <h1 className="font-semibold text-xl">{t("title")}</h1>
        </div>
        {!isCreateOpen && (
          <Button onClick={() => setIsCreateOpen(true)} size="sm">
            {t("createProject")}
          </Button>
        )}
      </div>
      <p className="mb-6 text-muted-foreground text-sm">
        {t("pageDescription")}
      </p>

      {/* Create Form */}
      {isCreateOpen && (
        <div className="mb-6 rounded-lg border p-4">
          <h2 className="mb-4 font-medium text-lg">{t("createProject")}</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-project-name">{t("projectName")}</Label>
              <Input
                id="new-project-name"
                maxLength={MAX_NAME_LENGTH}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && createName.trim()) {
                    handleCreate();
                  }
                }}
                placeholder={t("projectNamePlaceholder")}
                value={createName}
              />
            </div>
            <div className="flex gap-2">
              <Button
                disabled={!createName.trim() || isCreating}
                onClick={handleCreate}
                size="sm"
              >
                {tCommon("buttons.save")}
              </Button>
              <Button
                disabled={isCreating}
                onClick={closeCreate}
                size="sm"
                variant="outline"
              >
                {tCommon("buttons.cancel")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && projects.length === 0 && !isCreateOpen && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <FolderIcon size={48} />
          <p className="mt-4 font-medium text-lg">{t("noProjectsYet")}</p>
          <p className="mt-1 text-muted-foreground text-sm">
            {t("noProjectsDescription")}
          </p>
          <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
            {t("createProject")}
          </Button>
        </div>
      )}

      {/* Project List */}
      <div className="space-y-3">
        {projects.map((proj) => (
          // biome-ignore lint/a11y/useSemanticElements: can't use <button> — contains nested <Button> (delete) which is invalid HTML
          <div
            className="flex w-full cursor-pointer items-center justify-between rounded-lg border p-4 text-left transition-colors hover:bg-muted/50"
            key={proj.id}
            onClick={() => router.push(`/projects/${proj.id}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                router.push(`/projects/${proj.id}`);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{proj.name}</span>
                {proj.isDefault && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-primary text-xs">
                    {t("defaultBadge")}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-muted-foreground text-sm">
                {t("contextEntryCount", {
                  count: proj.contextEntries.length,
                })}
              </p>
            </div>

            <Button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(proj);
              }}
              size="icon"
              variant="ghost"
            >
              <TrashIcon size={16} />
            </Button>
          </div>
        ))}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        open={deleteTarget !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirmDescription", {
                name: deleteTarget?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("buttons.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {tCommon("buttons.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
