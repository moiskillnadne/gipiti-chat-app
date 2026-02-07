"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";
import { useStyle } from "@/contexts/style-context";
import type { TextStyle } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

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
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

const MAX_EXAMPLES = 20;
const MAX_EXAMPLE_LENGTH = 2000;
const MAX_NAME_LENGTH = 128;

type FormState = {
  name: string;
  examples: string[];
  isDefault: boolean;
};

const emptyForm: FormState = {
  name: "",
  examples: [""],
  isDefault: false,
};

export function StyleManager() {
  const t = useTranslations("textStyles");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { styles, refreshStyles, isLoading } = useStyle();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TextStyle | null>(null);
  const keyCounter = useRef(0);
  const [exampleKeys, setExampleKeys] = useState<number[]>([
    keyCounter.current++,
  ]);

  const isFormOpen = isCreating || editingId !== null;

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setExampleKeys([keyCounter.current++]);
    setIsCreating(true);
  };

  const openEdit = (style: TextStyle) => {
    setIsCreating(false);
    setEditingId(style.id);
    setForm({
      name: style.name,
      examples: [...style.examples],
      isDefault: style.isDefault,
    });
    setExampleKeys(style.examples.map(() => keyCounter.current++));
  };

  const closeForm = useCallback(() => {
    setIsCreating(false);
    setEditingId(null);
    setForm(emptyForm);
  }, []);

  const updateExample = (index: number, value: string) => {
    setForm((prev) => {
      const updated = [...prev.examples];
      updated[index] = value;
      return { ...prev, examples: updated };
    });
  };

  const addExample = () => {
    if (form.examples.length >= MAX_EXAMPLES) {
      return;
    }
    setForm((prev) => ({
      ...prev,
      examples: [...prev.examples, ""],
    }));
    setExampleKeys((prev) => [...prev, keyCounter.current++]);
  };

  const removeExample = (index: number) => {
    if (form.examples.length <= 1) {
      return;
    }
    setForm((prev) => ({
      ...prev,
      examples: prev.examples.filter((_, i) => i !== index),
    }));
    setExampleKeys((prev) => prev.filter((_, i) => i !== index));
  };

  const isFormValid =
    form.name.trim().length > 0 &&
    form.examples.every((e) => e.trim().length > 0);

  const handleSave = useCallback(async () => {
    if (!isFormValid || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const trimmedExamples = form.examples.map((e) => e.trim());

      if (editingId) {
        await fetch("/api/text-styles", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingId,
            name: form.name.trim(),
            examples: trimmedExamples,
            isDefault: form.isDefault,
          }),
        });
      } else {
        await fetch("/api/text-styles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            examples: trimmedExamples,
            isDefault: form.isDefault,
          }),
        });
      }

      toast({ type: "success", description: t("saveSuccess") });
      refreshStyles();
      closeForm();
    } catch {
      toast({ type: "error", description: t("saveError") });
    } finally {
      setIsSaving(false);
    }
  }, [isFormValid, isSaving, form, editingId, refreshStyles, t, closeForm]);

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

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button onClick={() => router.back()} size="sm" variant="ghost">
            {tCommon("buttons.back")}
          </Button>
          <h1 className="font-semibold text-xl">{t("title")}</h1>
        </div>
        {!isFormOpen && (
          <Button onClick={openCreate} size="sm">
            {t("createStyle")}
          </Button>
        )}
      </div>

      {/* Form */}
      {isFormOpen && (
        <div className="mb-6 rounded-lg border p-4">
          <h2 className="mb-4 font-medium text-lg">
            {editingId ? t("editStyle") : t("createStyle")}
          </h2>

          <div className="space-y-4">
            <div>
              <Label htmlFor="style-name">{t("styleName")}</Label>
              <Input
                id="style-name"
                maxLength={MAX_NAME_LENGTH}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder={t("styleNamePlaceholder")}
                value={form.name}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>{t("examples")}</Label>
                <span className="text-muted-foreground text-xs">
                  {form.examples.length}/{MAX_EXAMPLES}
                </span>
              </div>

              <div className="space-y-3">
                {form.examples.map((example, index) => (
                  <div className="flex gap-2" key={exampleKeys[index]}>
                    <Textarea
                      className="min-h-[80px] resize-y"
                      maxLength={MAX_EXAMPLE_LENGTH}
                      onChange={(e) => updateExample(index, e.target.value)}
                      placeholder={t("examplePlaceholder")}
                      value={example}
                    />
                    <Button
                      className="mt-0 shrink-0"
                      disabled={form.examples.length <= 1}
                      onClick={() => removeExample(index)}
                      size="icon"
                      variant="ghost"
                    >
                      <TrashIcon size={16} />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                className="mt-2"
                disabled={form.examples.length >= MAX_EXAMPLES}
                onClick={addExample}
                size="sm"
                variant="outline"
              >
                {t("addExample")}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={form.isDefault}
                id="is-default"
                onCheckedChange={(checked) =>
                  setForm((prev) => ({
                    ...prev,
                    isDefault: checked === true,
                  }))
                }
              />
              <Label className="cursor-pointer" htmlFor="is-default">
                {t("setAsDefault")}
              </Label>
            </div>

            <div className="flex gap-2">
              <Button
                disabled={!isFormValid || isSaving}
                onClick={handleSave}
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
        </div>
      )}

      {/* Style List */}
      {!isLoading && styles.length === 0 && !isFormOpen && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <PenIcon size={48} />
          <p className="mt-4 font-medium text-lg">{t("noStylesYet")}</p>
          <p className="mt-1 text-muted-foreground text-sm">
            {t("noStylesDescription")}
          </p>
          <Button className="mt-4" onClick={openCreate}>
            {t("createStyle")}
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {styles.map((style) => (
          <div
            className={cn(
              "flex items-center justify-between rounded-lg border p-4",
              editingId === style.id && "border-primary"
            )}
            key={style.id}
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
                {t("exampleCount", { count: style.examples.length })}
              </p>
            </div>

            <div className="flex gap-1">
              <Button
                onClick={() => openEdit(style)}
                size="icon"
                variant="ghost"
              >
                <PenIcon size={16} />
              </Button>
              <Button
                onClick={() => setDeleteTarget(style)}
                size="icon"
                variant="ghost"
              >
                <TrashIcon size={16} />
              </Button>
            </div>
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
