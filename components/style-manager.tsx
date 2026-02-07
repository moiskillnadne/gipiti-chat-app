"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { useStyle } from "@/contexts/style-context";
import type { TextStyle } from "@/lib/db/schema";

import { PenIcon, TrashIcon } from "./icons";
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

export function StyleManager() {
  const t = useTranslations("textStyles");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { styles, refreshStyles, isLoading } = useStyle();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TextStyle | null>(null);

  const handleCreate = useCallback(async () => {
    const trimmedName = createName.trim();
    if (!trimmedName || isCreating) {
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/text-styles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });

      if (!response.ok) {
        throw new Error("Failed to create style");
      }

      const newStyle = await response.json();
      refreshStyles();
      setIsCreateOpen(false);
      setCreateName("");
      router.push(`/styles/${newStyle.id}`);
    } catch {
      toast({ type: "error", description: t("saveError") });
    } finally {
      setIsCreating(false);
    }
  }, [createName, isCreating, refreshStyles, router, t]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      await fetch(`/api/text-styles?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      toast({ type: "success", description: t("deleteSuccess") });
      refreshStyles();
    } catch {
      toast({ type: "error", description: t("deleteError") });
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, refreshStyles, t]);

  const closeCreate = () => {
    setIsCreateOpen(false);
    setCreateName("");
  };

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button onClick={() => router.back()} size="sm" variant="ghost">
            {tCommon("buttons.back")}
          </Button>
          <h1 className="font-semibold text-xl">{t("title")}</h1>
        </div>
        {!isCreateOpen && (
          <Button onClick={() => setIsCreateOpen(true)} size="sm">
            {t("createStyle")}
          </Button>
        )}
      </div>

      {/* Create Form */}
      {isCreateOpen && (
        <div className="mb-6 rounded-lg border p-4">
          <h2 className="mb-4 font-medium text-lg">{t("createStyle")}</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-style-name">{t("styleName")}</Label>
              <Input
                id="new-style-name"
                maxLength={MAX_NAME_LENGTH}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && createName.trim()) {
                    handleCreate();
                  }
                }}
                placeholder={t("styleNamePlaceholder")}
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
      {!isLoading && styles.length === 0 && !isCreateOpen && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <PenIcon size={48} />
          <p className="mt-4 font-medium text-lg">{t("noStylesYet")}</p>
          <p className="mt-1 text-muted-foreground text-sm">
            {t("noStylesDescription")}
          </p>
          <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
            {t("createStyle")}
          </Button>
        </div>
      )}

      {/* Style List */}
      <div className="space-y-3">
        {styles.map((style) => (
          <button
            className="flex w-full cursor-pointer items-center justify-between rounded-lg border p-4 text-left transition-colors hover:bg-muted/50"
            key={style.id}
            onClick={() => router.push(`/styles/${style.id}`)}
            type="button"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{style.name}</span>
                {style.isDefault && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-primary text-xs">
                    {t("defaultBadge")}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-muted-foreground text-sm">
                {t("exampleCount", {
                  count: style.examples.length,
                })}
              </p>
            </div>

            <Button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(style);
              }}
              size="icon"
              variant="ghost"
            >
              <TrashIcon size={16} />
            </Button>
          </button>
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
