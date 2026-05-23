"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useProject } from "@/contexts/project-context";
import type { Project, ProjectFile } from "@/lib/db/schema";
import { useTranslations } from "@/lib/i18n/translate";
import {
  resolveSwatchToken,
  SWATCH_TOKENS,
  type SwatchToken,
  swatchTokenToClass,
} from "@/lib/utils/swatch";

import { FileIcon, PencilEditIcon, PlusIcon, TrashIcon } from "../icons";
import { toast } from "../toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";

const MAX_ITEMS = 20;
const MAX_ITEM_LENGTH = 2000;
const MAX_DESCRIPTION_LENGTH = 280;
const ALLOWED_FILE_TYPES =
  "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain,text/markdown";

export type EditorV1Props = {
  kind: "project";
  initialEntity: Project;
  initialFiles: ProjectFile[];
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} Б`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} КБ`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
};

const formatDate = (date: Date): string =>
  date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

export function EditorV1(props: EditorV1Props) {
  const router = useRouter();
  const tCommon = useTranslations("common");
  const tProjects = useTranslations("projects");
  const tEditor = useTranslations("projects.editor");
  const tShared = useTranslations("editorShared");

  const { refreshProjects } = useProject();

  const apiEndpoint = "/api/projects";
  const listRoute = "/projects";

  const [name, setName] = useState(props.initialEntity.name);
  const [description, setDescription] = useState(
    props.initialEntity.description ?? ""
  );
  const [swatch, setSwatch] = useState<SwatchToken>(
    resolveSwatchToken(props.initialEntity.swatch, props.initialEntity.id)
  );
  const [items, setItems] = useState<string[]>(
    props.initialEntity.contextEntries
  );
  const [pinned, setPinned] = useState(props.initialEntity.pinned);
  const [usageCount] = useState(props.initialEntity.usageCount);
  const [createdAt] = useState(new Date(props.initialEntity.createdAt));

  const [files, setFiles] = useState<ProjectFile[]>(props.initialFiles);
  const [isUploading, setIsUploading] = useState(false);

  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draftText, setDraftText] = useState("");
  const [deleteItemIdx, setDeleteItemIdx] = useState<number | null>(null);
  const [deleteEntityOpen, setDeleteEntityOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved"
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const patchEntity = useCallback(
    async (updates: Record<string, unknown>): Promise<boolean> => {
      setSaveStatus("saving");
      try {
        const response = await fetch(apiEndpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: props.initialEntity.id, ...updates }),
        });

        if (!response.ok) {
          throw new Error("Failed");
        }

        refreshProjects();
        setSaveStatus("saved");
        return true;
      } catch {
        setSaveStatus("error");
        toast({ type: "error", description: tProjects("saveError") });
        return false;
      }
    },
    [props.initialEntity.id, refreshProjects, tProjects]
  );

  const persistField = useCallback(
    async (field: string, value: unknown) => {
      await patchEntity({ [field]: value });
    },
    [patchEntity]
  );

  const persistItems = useCallback(
    async (next: string[]) => {
      setItems(next);
      await patchEntity({ contextEntries: next });
    },
    [patchEntity]
  );

  // ─── Item handlers ───────────────────────────────────────────────
  const startEdit = (i: number) => {
    setDraftText(items[i]);
    setEditingIdx(i);
  };
  const startAdd = () => {
    setDraftText("");
    setEditingIdx(items.length);
  };
  const cancelEdit = () => {
    setEditingIdx(null);
    setDraftText("");
  };
  const saveItem = async () => {
    const trimmed = draftText.trim();
    if (!trimmed) {
      cancelEdit();
      return;
    }
    if (editingIdx === null) {
      return;
    }
    const next = [...items];
    if (editingIdx >= items.length) {
      next.push(trimmed);
    } else {
      next[editingIdx] = trimmed;
    }
    setEditingIdx(null);
    setDraftText("");
    await persistItems(next);
    toast({
      type: "success",
      description: tProjects("contextEntrySaved"),
    });
  };
  const removeItem = async (i: number) => {
    const next = items.filter((_, j) => j !== i);
    await persistItems(next);
    toast({
      type: "success",
      description: tProjects("contextEntryDeleted"),
    });
    setDeleteItemIdx(null);
  };

  // ─── Entity actions ──────────────────────────────────────────────
  const handleDeleteEntity = useCallback(async () => {
    try {
      await fetch(`${apiEndpoint}?id=${props.initialEntity.id}`, {
        method: "DELETE",
      });
      toast({ type: "success", description: tProjects("deleteSuccess") });
      refreshProjects();
      router.push(listRoute);
    } catch {
      toast({ type: "error", description: tProjects("deleteError") });
    }
  }, [props.initialEntity.id, refreshProjects, router, tProjects]);

  // ─── File handlers ───────────────────────────────────────────────
  const uploadFiles = useCallback(
    async (selected: FileList | File[]) => {
      setIsUploading(true);
      try {
        const newFiles: ProjectFile[] = [];
        for (const file of Array.from(selected)) {
          const formData = new FormData();
          formData.append("file", file);
          const response = await fetch(
            `/api/projects/${props.initialEntity.id}/files`,
            { method: "POST", body: formData }
          );
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            toast({
              type: "error",
              description: data.error ?? tShared("files.uploadError"),
            });
            continue;
          }
          newFiles.push((await response.json()) as ProjectFile);
        }
        if (newFiles.length > 0) {
          setFiles((prev) => [...newFiles, ...prev]);
        }
      } finally {
        setIsUploading(false);
      }
    },
    [props.initialEntity.id, tShared]
  );

  const handleDeleteFile = useCallback(
    async (fileId: string) => {
      try {
        await fetch(`/api/projects/${props.initialEntity.id}/files/${fileId}`, {
          method: "DELETE",
        });
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
      } catch {
        toast({
          type: "error",
          description: tShared("files.deleteError"),
        });
      }
    },
    [props.initialEntity.id, tShared]
  );

  // ─── Drag and drop ───────────────────────────────────────────────
  const [isDragOver, setIsDragOver] = useState(false);
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  // ─── Effects ─────────────────────────────────────────────────────
  // Auto-clear "saved" status indicator on next change
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
    }
  }, []);

  const itemNoun = tShared("nouns.entry");
  const itemNounPl = tShared("nouns.entriesPl");
  const itemLabelPrefix = tShared("nouns.entryLabel");

  return (
    <div className="editor-v1-stage">
      <div className="editor-v1-topbar">
        <button
          className="editor-v1-btn editor-v1-btn-ghost editor-v1-btn-sm"
          onClick={() => router.push(listRoute)}
          type="button"
        >
          ← {tCommon("buttons.back")}
        </button>
        <span className="editor-v1-crumb">
          <span className="editor-v1-crumb-link">{tProjects("title")}</span>
          <span className="editor-v1-crumb-sep">/</span>
          <b>{name || tEditor("untitledProject")}</b>
        </span>
        <div className="editor-v1-topbar-right">
          <span
            className={`editor-v1-save-status ${saveStatus === "saving" ? "editor-v1-save-status-saving" : ""} ${saveStatus === "error" ? "editor-v1-save-status-error" : ""}`}
          >
            {saveStatus === "saving" && tShared("status.saving")}
            {saveStatus === "saved" && `● ${tShared("status.saved")}`}
            {saveStatus === "error" && `! ${tShared("status.error")}`}
          </span>
        </div>
      </div>

      <div className="editor-v1-body">
        <div className="editor-v1-doc">
          {/* Hero */}
          <div className="editor-v1-hero">
            <div className="editor-v1-hero-row">
              <span
                aria-hidden
                className={`editor-v1-swatch-big ${swatchTokenToClass(swatch)}`}
              />
              <h1>
                <input
                  className="editor-v1-name-input"
                  maxLength={128}
                  onBlur={(e) => persistField("name", e.target.value.trim())}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={tProjects("projectNamePlaceholder")}
                  value={name}
                />
              </h1>
            </div>
            <div className="editor-v1-desc">
              <input
                maxLength={MAX_DESCRIPTION_LENGTH}
                onBlur={(e) =>
                  persistField("description", e.target.value.trim() || null)
                }
                onChange={(e) => setDescription(e.target.value)}
                placeholder={tEditor("descriptionPlaceholder")}
                value={description}
              />
            </div>
            <div className="editor-v1-meta-row">
              <span className="editor-v1-swatch-pick">
                {SWATCH_TOKENS.map((token) => (
                  <button
                    aria-label={`${tShared("swatchPicker.label")} ${token}`}
                    className={`${swatchTokenToClass(token)} ${swatch === token ? "on" : ""}`}
                    key={token}
                    onClick={() => {
                      setSwatch(token);
                      persistField("swatch", token);
                    }}
                    type="button"
                  />
                ))}
              </span>
              {usageCount > 0 && (
                <span className="editor-v1-usage-meta">
                  ↗{" "}
                  {tShared("usageMeta", {
                    count: usageCount,
                    date: formatDate(createdAt),
                  })}
                </span>
              )}
            </div>
          </div>

          {/* Items */}
          <section className="editor-v1-section">
            <header className="editor-v1-section-h">
              <h2>{tProjects("contextEntries")}</h2>
              <span className="editor-v1-ct">
                {items.length} / {MAX_ITEMS}
              </span>
            </header>
            <p className="editor-v1-help">{tEditor("itemsHelpProject")}</p>

            {items.length === 0 && editingIdx === null ? (
              <div className="editor-v1-empty">
                <h3>{tShared("empty.title", { itemPl: itemNounPl })}</h3>
                <p>{tEditor("emptyDescriptionProject")}</p>
                <button
                  className="editor-v1-btn editor-v1-btn-primary"
                  onClick={startAdd}
                  type="button"
                >
                  <PlusIcon size={13} />
                  {tShared("empty.cta", { item: itemNoun })}
                </button>
              </div>
            ) : (
              <div className="editor-v1-ex-list">
                {items.map((ex, i) => (
                  <div
                    className={`editor-v1-ex ${editingIdx === i ? "editing" : ""}`}
                    key={`item-${i.toString()}`}
                  >
                    <div className="editor-v1-ex-h">
                      <span className="editor-v1-lbl">
                        {itemLabelPrefix} {String(i + 1).padStart(2, "0")}
                      </span>
                      {editingIdx !== i && (
                        <span className="editor-v1-ex-actions">
                          <button
                            className="editor-v1-btn editor-v1-btn-ghost editor-v1-btn-sm"
                            onClick={() => startEdit(i)}
                            type="button"
                          >
                            <PencilEditIcon size={13} />
                          </button>
                          <button
                            className="editor-v1-btn editor-v1-btn-ghost editor-v1-btn-sm editor-v1-btn-danger"
                            onClick={() => setDeleteItemIdx(i)}
                            type="button"
                          >
                            <TrashIcon size={13} />
                          </button>
                        </span>
                      )}
                    </div>
                    {editingIdx === i ? (
                      <>
                        <textarea
                          autoFocus
                          maxLength={MAX_ITEM_LENGTH}
                          onChange={(e) => setDraftText(e.target.value)}
                          value={draftText}
                        />
                        <div className="editor-v1-ex-foot">
                          <button
                            className="editor-v1-btn editor-v1-btn-primary editor-v1-btn-sm"
                            onClick={saveItem}
                            type="button"
                          >
                            {tCommon("buttons.save")}
                          </button>
                          <button
                            className="editor-v1-btn editor-v1-btn-ghost editor-v1-btn-sm"
                            onClick={cancelEdit}
                            type="button"
                          >
                            {tCommon("buttons.cancel")}
                          </button>
                          <span className="editor-v1-ct">
                            {draftText.length} / {MAX_ITEM_LENGTH}
                          </span>
                        </div>
                      </>
                    ) : (
                      <button
                        className="editor-v1-ex-text"
                        onClick={() => startEdit(i)}
                        type="button"
                      >
                        <p>{ex}</p>
                      </button>
                    )}
                  </div>
                ))}

                {editingIdx === items.length && (
                  <div className="editor-v1-ex editing">
                    <div className="editor-v1-ex-h">
                      <span className="editor-v1-lbl">
                        {itemLabelPrefix}{" "}
                        {String(items.length + 1).padStart(2, "0")} ·{" "}
                        {tShared("newSuffix")}
                      </span>
                    </div>
                    <textarea
                      autoFocus
                      maxLength={MAX_ITEM_LENGTH}
                      onChange={(e) => setDraftText(e.target.value)}
                      placeholder={tProjects("contextEntryPlaceholder")}
                      value={draftText}
                    />
                    <div className="editor-v1-ex-foot">
                      <button
                        className="editor-v1-btn editor-v1-btn-primary editor-v1-btn-sm"
                        onClick={saveItem}
                        type="button"
                      >
                        {tShared("addBtn")}
                      </button>
                      <button
                        className="editor-v1-btn editor-v1-btn-ghost editor-v1-btn-sm"
                        onClick={cancelEdit}
                        type="button"
                      >
                        {tCommon("buttons.cancel")}
                      </button>
                      <span className="editor-v1-ct">
                        {draftText.length} / {MAX_ITEM_LENGTH}
                      </span>
                    </div>
                  </div>
                )}

                {editingIdx !== items.length && items.length < MAX_ITEMS && (
                  <button
                    className="editor-v1-add-row"
                    onClick={startAdd}
                    type="button"
                  >
                    <PlusIcon size={14} />
                    {tShared("addItem", { item: itemNoun })}
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Files */}
          <section className="editor-v1-section">
            <header className="editor-v1-section-h">
              <h2>{tShared("files.heading")}</h2>
              <span className="editor-v1-ct">
                {tShared("files.fileCount", { count: files.length })}
              </span>
            </header>
            <p className="editor-v1-help">{tShared("files.help")}</p>

            {files.length > 0 && (
              <div className="editor-v1-files">
                {files.map((f) => (
                  <div className="editor-v1-file" key={f.id}>
                    <span className="editor-v1-file-ico">
                      <FileIcon size={14} />
                    </span>
                    <a
                      className="editor-v1-file-nm"
                      href={f.blobUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {f.name}
                    </a>
                    <span className="editor-v1-file-meta">
                      {formatBytes(f.size)}
                    </span>
                    <button
                      className="editor-v1-btn editor-v1-btn-ghost editor-v1-btn-sm editor-v1-btn-danger"
                      onClick={() => handleDeleteFile(f.id)}
                      type="button"
                    >
                      <TrashIcon size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              className={`editor-v1-add-row ${isDragOver ? "drag-over" : ""}`}
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              type="button"
            >
              <PlusIcon size={14} />
              {isUploading
                ? tShared("files.uploading")
                : tShared("files.dropzone")}
            </button>
            <input
              accept={ALLOWED_FILE_TYPES}
              hidden
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  uploadFiles(e.target.files);
                  e.target.value = "";
                }
              }}
              ref={fileInputRef}
              type="file"
            />
          </section>

          {/* Settings */}
          <section className="editor-v1-section">
            <header className="editor-v1-section-h">
              <h2>{tShared("settings.heading")}</h2>
            </header>
            <div className="editor-v1-toggle-row">
              <div className="editor-v1-toggle-lhs">
                <b>{tShared("settings.pinTitle")}</b>
                <span>{tShared("settings.pinHelp")}</span>
              </div>
              <button
                aria-label={pinned ? tProjects("unpin") : tProjects("pin")}
                aria-pressed={pinned}
                className={`editor-v1-switch ${pinned ? "on" : ""}`}
                onClick={() => {
                  const next = !pinned;
                  setPinned(next);
                  persistField("pinned", next);
                }}
                type="button"
              />
            </div>
          </section>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="editor-v1-save-bar">
        <div className="editor-v1-save-bar-meta">
          {tShared("saveBar.autosave")}
        </div>
        <div className="editor-v1-save-bar-right">
          <button
            className="editor-v1-btn editor-v1-btn-ghost editor-v1-btn-sm editor-v1-btn-danger"
            onClick={() => setDeleteEntityOpen(true)}
            type="button"
          >
            <TrashIcon size={13} />
            {tCommon("buttons.delete")}
          </button>
          <button
            className="editor-v1-btn editor-v1-btn-outline"
            onClick={() => router.push(listRoute)}
            type="button"
          >
            {tShared("saveBar.backToList")}
          </button>
        </div>
      </div>

      {/* Delete-item confirm */}
      <AlertDialog
        onOpenChange={(open) => !open && setDeleteItemIdx(null)}
        open={deleteItemIdx !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tProjects("deleteContextEntryConfirm")}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("buttons.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteItemIdx !== null && removeItem(deleteItemIdx)
              }
            >
              {tCommon("buttons.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete-entity confirm */}
      <AlertDialog
        onOpenChange={(open) => !open && setDeleteEntityOpen(false)}
        open={deleteEntityOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tProjects("deleteConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tProjects("deleteConfirmDescription", { name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("buttons.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEntity}>
              {tCommon("buttons.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
