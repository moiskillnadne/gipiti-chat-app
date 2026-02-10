"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useProject } from "@/contexts/project-context";
import type { Project } from "@/lib/db/schema";

import { CheckCircleFillIcon, CrossIcon, PenIcon, TrashIcon } from "./icons";
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
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

const MAX_CONTEXT_ENTRIES = 20;
const MAX_CONTEXT_ENTRY_LENGTH = 2000;

export function ProjectDetail({ initialProject }: { initialProject: Project }) {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { refreshProjects } = useProject();

  const [proj, setProj] = useState<Project>(initialProject);
  const [isAdding, setIsAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formText, setFormText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deleteEntryIndex, setDeleteEntryIndex] = useState<number | null>(null);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName) {
      nameInputRef.current?.focus();
    }
  }, [isEditingName]);

  const patchProject = useCallback(
    async (updates: {
      name?: string;
      contextEntries?: string[];
      isDefault?: boolean;
    }): Promise<Project | null> => {
      try {
        const response = await fetch("/api/projects", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: proj.id, ...updates }),
        });

        if (!response.ok) {
          throw new Error("Failed to update project");
        }

        const updated: Project = await response.json();
        setProj(updated);
        refreshProjects();
        return updated;
      } catch {
        toast({ type: "error", description: t("saveError") });
        return null;
      }
    },
    [proj.id, refreshProjects, t]
  );

  const handleSaveName = useCallback(async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const result = await patchProject({ name: trimmed });
      if (result) {
        toast({ type: "success", description: t("renameSuccess") });
        setIsEditingName(false);
      }
    } finally {
      setIsSaving(false);
    }
  }, [nameInput, isSaving, patchProject, t]);

  const handleSaveEntry = useCallback(async () => {
    const trimmed = formText.trim();
    if (!trimmed || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const updatedEntries = [...proj.contextEntries];

      if (editingIndex !== null) {
        updatedEntries[editingIndex] = trimmed;
      } else {
        updatedEntries.unshift(trimmed);
      }

      const result = await patchProject({ contextEntries: updatedEntries });

      if (result) {
        toast({ type: "success", description: t("contextEntrySaved") });
        setFormText("");
        setIsAdding(false);
        setEditingIndex(null);
      }
    } finally {
      setIsSaving(false);
    }
  }, [formText, isSaving, proj.contextEntries, editingIndex, patchProject, t]);

  const handleDeleteEntry = useCallback(async () => {
    if (deleteEntryIndex === null) {
      return;
    }

    const updatedEntries = proj.contextEntries.filter(
      (_, i) => i !== deleteEntryIndex
    );
    const result = await patchProject({ contextEntries: updatedEntries });

    if (result) {
      toast({ type: "success", description: t("contextEntryDeleted") });
    }

    setDeleteEntryIndex(null);
  }, [deleteEntryIndex, proj.contextEntries, patchProject, t]);

  const handleDeleteProject = useCallback(async () => {
    try {
      await fetch(`/api/projects?id=${proj.id}`, {
        method: "DELETE",
      });
      toast({ type: "success", description: t("deleteSuccess") });
      refreshProjects();
      router.push("/projects");
    } catch {
      toast({ type: "error", description: t("deleteError") });
    }
  }, [proj.id, refreshProjects, router, t]);

  const handleToggleDefault = useCallback(
    async (checked: boolean) => {
      await patchProject({ isDefault: checked });
    },
    [patchProject]
  );

  const openAdd = () => {
    setEditingIndex(null);
    setFormText("");
    setIsAdding(true);
  };

  const openEdit = (index: number) => {
    setIsAdding(false);
    setEditingIndex(index);
    setFormText(proj.contextEntries[index]);
  };

  const closeForm = () => {
    setIsAdding(false);
    setEditingIndex(null);
    setFormText("");
  };

  const isFormOpen = isAdding || editingIndex !== null;

  return (
    <div className="flex h-dvh flex-col px-4 py-8">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            onClick={() => router.push("/projects")}
            size="sm"
            variant="ghost"
          >
            {tCommon("buttons.back")}
          </Button>
          {isEditingName ? (
            <div className="flex min-w-0 items-center gap-2">
              <input
                className="min-w-0 flex-1 rounded border bg-transparent px-2 py-1 font-semibold text-xl outline-none focus:border-primary"
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveName();
                  }
                  if (e.key === "Escape") {
                    setIsEditingName(false);
                  }
                }}
                ref={nameInputRef}
                value={nameInput}
              />
              <Button
                disabled={!nameInput.trim() || isSaving}
                onClick={handleSaveName}
                size="icon"
                title={tCommon("buttons.save")}
                variant="ghost"
              >
                <CheckCircleFillIcon size={16} />
              </Button>
              <Button
                disabled={isSaving}
                onClick={() => setIsEditingName(false)}
                size="icon"
                title={tCommon("buttons.cancel")}
                variant="ghost"
              >
                <CrossIcon size={16} />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <h1 className="font-semibold text-xl">
                {t("projectTitle", { name: proj.name })}
              </h1>
              <Button
                onClick={() => {
                  setNameInput(proj.name);
                  setIsEditingName(true);
                }}
                size="icon"
                title={t("editName")}
                variant="ghost"
              >
                <PenIcon size={16} />
              </Button>
            </div>
          )}
        </div>
        <Button
          onClick={() => setDeleteProjectOpen(true)}
          size="sm"
          variant="ghost"
        >
          <TrashIcon size={16} />
        </Button>
      </div>

      {/* Default checkbox */}
      <div className="mb-6 flex items-center gap-2">
        <Checkbox
          checked={proj.isDefault}
          id="is-default"
          onCheckedChange={(checked) => handleToggleDefault(checked === true)}
        />
        <Label className="cursor-pointer" htmlFor="is-default">
          {t("setAsDefault")}
        </Label>
      </div>

      {/* Context entries header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium text-lg">{t("contextEntries")}</h2>
        {!isFormOpen && proj.contextEntries.length < MAX_CONTEXT_ENTRIES && (
          <Button onClick={openAdd} size="sm" variant="outline">
            {t("addContextEntry")}
          </Button>
        )}
      </div>

      {/* Empty state */}
      {proj.contextEntries.length === 0 && !isFormOpen && (
        <div className="mb-4 rounded-lg border border-dashed p-6 text-center">
          <p className="font-medium">{t("noContextEntriesYet")}</p>
          <p className="mt-1 text-muted-foreground text-sm">
            {t("noContextEntriesDescription")}
          </p>
          <Button
            className="mt-3"
            onClick={openAdd}
            size="sm"
            variant="outline"
          >
            {t("addContextEntry")}
          </Button>
        </div>
      )}

      {/* Context entries list */}
      <div className="space-y-3 overflow-y-auto">
        {/* Add form (top of list) */}
        {isAdding && (
          <div className="rounded-lg border border-primary p-4">
            <Textarea
              className="min-h-[120px] resize-y"
              maxLength={MAX_CONTEXT_ENTRY_LENGTH}
              onChange={(e) => setFormText(e.target.value)}
              placeholder={t("contextEntryPlaceholder")}
              value={formText}
            />
            <div className="mt-3 flex gap-2">
              <Button
                disabled={!formText.trim() || isSaving}
                onClick={handleSaveEntry}
                size="sm"
              >
                {tCommon("buttons.save")}
              </Button>
              <Button
                disabled={isSaving}
                onClick={closeForm}
                size="sm"
                variant="outline"
              >
                {tCommon("buttons.cancel")}
              </Button>
            </div>
          </div>
        )}

        {proj.contextEntries.map((entry, index) =>
          editingIndex === index ? (
            <div
              className="rounded-lg border border-primary p-4"
              key={`edit-${index.toString()}`}
            >
              <Textarea
                className="min-h-[120px] resize-y"
                maxLength={MAX_CONTEXT_ENTRY_LENGTH}
                onChange={(e) => setFormText(e.target.value)}
                placeholder={t("contextEntryPlaceholder")}
                value={formText}
              />
              <div className="mt-3 flex gap-2">
                <Button
                  disabled={!formText.trim() || isSaving}
                  onClick={handleSaveEntry}
                  size="sm"
                >
                  {tCommon("buttons.save")}
                </Button>
                <Button
                  disabled={isSaving}
                  onClick={closeForm}
                  size="sm"
                  variant="outline"
                >
                  {tCommon("buttons.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="group flex items-start gap-3 rounded-lg border p-4"
              key={`entry-${index.toString()}`}
            >
              <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm">
                {entry}
              </p>
              <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  onClick={() => openEdit(index)}
                  size="icon"
                  title={t("editContextEntry")}
                  variant="ghost"
                >
                  <PenIcon size={16} />
                </Button>
                <Button
                  onClick={() => setDeleteEntryIndex(index)}
                  size="icon"
                  title={t("deleteContextEntry")}
                  variant="ghost"
                >
                  <TrashIcon size={16} />
                </Button>
              </div>
            </div>
          )
        )}
      </div>

      {/* Delete entry confirmation */}
      <AlertDialog
        onOpenChange={(open) => !open && setDeleteEntryIndex(null)}
        open={deleteEntryIndex !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("deleteContextEntryConfirm")}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("buttons.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEntry}>
              {tCommon("buttons.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete project confirmation */}
      <AlertDialog
        onOpenChange={(open) => !open && setDeleteProjectOpen(false)}
        open={deleteProjectOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirmDescription", {
                name: proj.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("buttons.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject}>
              {tCommon("buttons.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
