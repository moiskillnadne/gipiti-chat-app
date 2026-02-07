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
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

const MAX_EXAMPLES = 20;
const MAX_EXAMPLE_LENGTH = 2000;

export function StyleDetail({ initialStyle }: { initialStyle: TextStyle }) {
  const t = useTranslations("textStyles");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { refreshStyles } = useStyle();

  const [style, setStyle] = useState<TextStyle>(initialStyle);
  const [isAdding, setIsAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formText, setFormText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deleteExampleIndex, setDeleteExampleIndex] = useState<number | null>(
    null
  );
  const [deleteStyleOpen, setDeleteStyleOpen] = useState(false);

  const patchStyle = useCallback(
    async (updates: {
      examples?: string[];
      isDefault?: boolean;
    }): Promise<TextStyle | null> => {
      try {
        const response = await fetch("/api/text-styles", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: style.id, ...updates }),
        });

        if (!response.ok) {
          throw new Error("Failed to update style");
        }

        const updated: TextStyle = await response.json();
        setStyle(updated);
        refreshStyles();
        return updated;
      } catch {
        toast({ type: "error", description: t("saveError") });
        return null;
      }
    },
    [style.id, refreshStyles, t]
  );

  const handleSaveExample = useCallback(async () => {
    const trimmed = formText.trim();
    if (!trimmed || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const updatedExamples = [...style.examples];

      if (editingIndex !== null) {
        updatedExamples[editingIndex] = trimmed;
      } else {
        updatedExamples.push(trimmed);
      }

      const result = await patchStyle({ examples: updatedExamples });

      if (result) {
        toast({ type: "success", description: t("exampleSaved") });
        setFormText("");
        setIsAdding(false);
        setEditingIndex(null);
      }
    } finally {
      setIsSaving(false);
    }
  }, [formText, isSaving, style.examples, editingIndex, patchStyle, t]);

  const handleDeleteExample = useCallback(async () => {
    if (deleteExampleIndex === null) {
      return;
    }

    const updatedExamples = style.examples.filter(
      (_, i) => i !== deleteExampleIndex
    );
    const result = await patchStyle({ examples: updatedExamples });

    if (result) {
      toast({ type: "success", description: t("exampleDeleted") });
    }

    setDeleteExampleIndex(null);
  }, [deleteExampleIndex, style.examples, patchStyle, t]);

  const handleDeleteStyle = useCallback(async () => {
    try {
      await fetch(`/api/text-styles?id=${style.id}`, {
        method: "DELETE",
      });
      toast({ type: "success", description: t("deleteSuccess") });
      refreshStyles();
      router.push("/styles");
    } catch {
      toast({ type: "error", description: t("deleteError") });
    }
  }, [style.id, refreshStyles, router, t]);

  const handleToggleDefault = useCallback(
    async (checked: boolean) => {
      await patchStyle({ isDefault: checked });
    },
    [patchStyle]
  );

  const openAdd = () => {
    setEditingIndex(null);
    setFormText("");
    setIsAdding(true);
  };

  const openEdit = (index: number) => {
    setIsAdding(false);
    setEditingIndex(index);
    setFormText(style.examples[index]);
  };

  const closeForm = () => {
    setIsAdding(false);
    setEditingIndex(null);
    setFormText("");
  };

  const isFormOpen = isAdding || editingIndex !== null;

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col px-4 py-8">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => router.push("/styles")}
            size="sm"
            variant="ghost"
          >
            {tCommon("buttons.back")}
          </Button>
          <h1 className="font-semibold text-xl">
            {t("styleTitle", { name: style.name })}
          </h1>
        </div>
        <Button
          onClick={() => setDeleteStyleOpen(true)}
          size="sm"
          variant="ghost"
        >
          <TrashIcon size={16} />
        </Button>
      </div>

      {/* Default checkbox */}
      <div className="mb-6 flex items-center gap-2">
        <Checkbox
          checked={style.isDefault}
          id="is-default"
          onCheckedChange={(checked) => handleToggleDefault(checked === true)}
        />
        <Label className="cursor-pointer" htmlFor="is-default">
          {t("setAsDefault")}
        </Label>
      </div>

      {/* Examples header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium text-lg">{t("examples")}</h2>
        {!isFormOpen && style.examples.length < MAX_EXAMPLES && (
          <Button onClick={openAdd} size="sm" variant="outline">
            {t("addExample")}
          </Button>
        )}
      </div>

      {/* Empty state */}
      {style.examples.length === 0 && !isFormOpen && (
        <div className="mb-4 rounded-lg border border-dashed p-6 text-center">
          <p className="font-medium">{t("noExamplesYet")}</p>
          <p className="mt-1 text-muted-foreground text-sm">
            {t("noExamplesDescription")}
          </p>
          <Button
            className="mt-3"
            onClick={openAdd}
            size="sm"
            variant="outline"
          >
            {t("addExample")}
          </Button>
        </div>
      )}

      {/* Examples list */}
      <div className="space-y-3 overflow-y-auto">
        {style.examples.map((example, index) =>
          editingIndex === index ? (
            <div
              className="rounded-lg border border-primary p-4"
              key={`edit-${index.toString()}`}
            >
              <Textarea
                className="min-h-[120px] resize-y"
                maxLength={MAX_EXAMPLE_LENGTH}
                onChange={(e) => setFormText(e.target.value)}
                placeholder={t("examplePlaceholder")}
                value={formText}
              />
              <div className="mt-3 flex gap-2">
                <Button
                  disabled={!formText.trim() || isSaving}
                  onClick={handleSaveExample}
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
              key={`example-${index.toString()}`}
            >
              <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm">
                {example}
              </p>
              <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  onClick={() => openEdit(index)}
                  size="icon"
                  title={t("editExample")}
                  variant="ghost"
                >
                  <PenIcon size={16} />
                </Button>
                <Button
                  onClick={() => setDeleteExampleIndex(index)}
                  size="icon"
                  title={t("deleteExample")}
                  variant="ghost"
                >
                  <TrashIcon size={16} />
                </Button>
              </div>
            </div>
          )
        )}

        {/* Add form (below list) */}
        {isAdding && (
          <div className="rounded-lg border border-primary p-4">
            <Textarea
              className="min-h-[120px] resize-y"
              maxLength={MAX_EXAMPLE_LENGTH}
              onChange={(e) => setFormText(e.target.value)}
              placeholder={t("examplePlaceholder")}
              value={formText}
            />
            <div className="mt-3 flex gap-2">
              <Button
                disabled={!formText.trim() || isSaving}
                onClick={handleSaveExample}
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
      </div>

      {/* Delete example confirmation */}
      <AlertDialog
        onOpenChange={(open) => !open && setDeleteExampleIndex(null)}
        open={deleteExampleIndex !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteExampleConfirm")}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("buttons.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExample}>
              {tCommon("buttons.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete style confirmation */}
      <AlertDialog
        onOpenChange={(open) => !open && setDeleteStyleOpen(false)}
        open={deleteStyleOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirmDescription", {
                name: style.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("buttons.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStyle}>
              {tCommon("buttons.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
