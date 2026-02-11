"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

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

type EntityBase = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type EntityDetailLabels = {
  title: (name: string) => string;
  editName: string;
  saveError: string;
  renameSuccess: string;
  itemSaved: string;
  itemDeleted: string;
  deleteSuccess: string;
  deleteError: string;
  setAsDefault: string;
  itemsHeader: string;
  addItem: string;
  noItemsYet: string;
  noItemsDescription: string;
  itemPlaceholder: string;
  editItem: string;
  deleteItem: string;
  deleteItemConfirm: string;
  deleteConfirmTitle: string;
  deleteConfirmDescription: (name: string) => string;
  back: string;
  save: string;
  cancel: string;
  delete: string;
};

export type EntityDetailConfig<T extends EntityBase> = {
  apiEndpoint: string;
  listRoute: string;
  maxItems: number;
  maxItemLength: number;
  getItems: (entity: T) => string[];
  buildItemsPatch: (items: string[]) => Record<string, string[]>;
  refreshEntities: () => void;
};

type EntityDetailProps<T extends EntityBase> = {
  initialEntity: T;
  config: EntityDetailConfig<T>;
  labels: EntityDetailLabels;
};

export function EntityDetail<T extends EntityBase>({
  initialEntity,
  config,
  labels,
}: EntityDetailProps<T>) {
  const router = useRouter();
  const {
    apiEndpoint,
    listRoute,
    maxItems,
    maxItemLength,
    getItems,
    buildItemsPatch,
    refreshEntities,
  } = config;

  const [entity, setEntity] = useState<T>(initialEntity);
  const [isAdding, setIsAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formText, setFormText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deleteItemIndex, setDeleteItemIndex] = useState<number | null>(null);
  const [deleteEntityOpen, setDeleteEntityOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const items = getItems(entity);

  useEffect(() => {
    if (isEditingName) {
      nameInputRef.current?.focus();
    }
  }, [isEditingName]);

  const patchEntity = useCallback(
    async (updates: Record<string, unknown>): Promise<T | null> => {
      try {
        const response = await fetch(apiEndpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: entity.id, ...updates }),
        });

        if (!response.ok) {
          throw new Error("Failed to update entity");
        }

        const updated: T = await response.json();
        setEntity(updated);
        refreshEntities();
        return updated;
      } catch {
        toast({ type: "error", description: labels.saveError });
        return null;
      }
    },
    [entity.id, apiEndpoint, refreshEntities, labels.saveError]
  );

  const handleSaveName = useCallback(async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const result = await patchEntity({ name: trimmed });
      if (result) {
        toast({ type: "success", description: labels.renameSuccess });
        setIsEditingName(false);
      }
    } finally {
      setIsSaving(false);
    }
  }, [nameInput, isSaving, patchEntity, labels.renameSuccess]);

  const handleSaveItem = useCallback(async () => {
    const trimmed = formText.trim();
    if (!trimmed || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const updatedItems = [...items];

      if (editingIndex !== null) {
        updatedItems[editingIndex] = trimmed;
      } else {
        updatedItems.unshift(trimmed);
      }

      const result = await patchEntity(buildItemsPatch(updatedItems));

      if (result) {
        toast({ type: "success", description: labels.itemSaved });
        setFormText("");
        setIsAdding(false);
        setEditingIndex(null);
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    formText,
    isSaving,
    items,
    editingIndex,
    patchEntity,
    buildItemsPatch,
    labels.itemSaved,
  ]);

  const handleDeleteItem = useCallback(async () => {
    if (deleteItemIndex === null) {
      return;
    }

    const updatedItems = items.filter((_, i) => i !== deleteItemIndex);
    const result = await patchEntity(buildItemsPatch(updatedItems));

    if (result) {
      toast({ type: "success", description: labels.itemDeleted });
    }

    setDeleteItemIndex(null);
  }, [
    deleteItemIndex,
    items,
    patchEntity,
    buildItemsPatch,
    labels.itemDeleted,
  ]);

  const handleDeleteEntity = useCallback(async () => {
    try {
      await fetch(`${apiEndpoint}?id=${entity.id}`, {
        method: "DELETE",
      });
      toast({ type: "success", description: labels.deleteSuccess });
      refreshEntities();
      router.push(listRoute);
    } catch {
      toast({ type: "error", description: labels.deleteError });
    }
  }, [
    entity.id,
    apiEndpoint,
    refreshEntities,
    router,
    listRoute,
    labels.deleteSuccess,
    labels.deleteError,
  ]);

  const handleToggleDefault = useCallback(
    async (checked: boolean) => {
      await patchEntity({ isDefault: checked });
    },
    [patchEntity]
  );

  const openAdd = () => {
    setEditingIndex(null);
    setFormText("");
    setIsAdding(true);
  };

  const openEdit = (index: number) => {
    setIsAdding(false);
    setEditingIndex(index);
    setFormText(items[index]);
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
            onClick={() => router.push(listRoute)}
            size="sm"
            variant="ghost"
          >
            {labels.back}
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
                title={labels.save}
                variant="ghost"
              >
                <CheckCircleFillIcon size={16} />
              </Button>
              <Button
                disabled={isSaving}
                onClick={() => setIsEditingName(false)}
                size="icon"
                title={labels.cancel}
                variant="ghost"
              >
                <CrossIcon size={16} />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <h1 className="font-semibold text-xl">
                {labels.title(entity.name)}
              </h1>
              <Button
                onClick={() => {
                  setNameInput(entity.name);
                  setIsEditingName(true);
                }}
                size="icon"
                title={labels.editName}
                variant="ghost"
              >
                <PenIcon size={16} />
              </Button>
            </div>
          )}
        </div>
        <Button
          onClick={() => setDeleteEntityOpen(true)}
          size="sm"
          variant="ghost"
        >
          <TrashIcon size={16} />
        </Button>
      </div>

      {/* Default checkbox */}
      <div className="mb-6 flex items-center gap-2">
        <Checkbox
          checked={entity.isDefault}
          id="is-default"
          onCheckedChange={(checked) => handleToggleDefault(checked === true)}
        />
        <Label className="cursor-pointer" htmlFor="is-default">
          {labels.setAsDefault}
        </Label>
      </div>

      {/* Items header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium text-lg">{labels.itemsHeader}</h2>
        {!isFormOpen && items.length < maxItems && (
          <Button onClick={openAdd} size="sm" variant="outline">
            {labels.addItem}
          </Button>
        )}
      </div>

      {/* Empty state */}
      {items.length === 0 && !isFormOpen && (
        <div className="mb-4 rounded-lg border border-dashed p-6 text-center">
          <p className="font-medium">{labels.noItemsYet}</p>
          <p className="mt-1 text-muted-foreground text-sm">
            {labels.noItemsDescription}
          </p>
          <Button
            className="mt-3"
            onClick={openAdd}
            size="sm"
            variant="outline"
          >
            {labels.addItem}
          </Button>
        </div>
      )}

      {/* Items list */}
      <div className="space-y-3 overflow-y-auto">
        {/* Add form (top of list) */}
        {isAdding && (
          <div className="rounded-lg border border-primary p-4">
            <Textarea
              className="min-h-[120px] resize-y"
              maxLength={maxItemLength}
              onChange={(e) => setFormText(e.target.value)}
              placeholder={labels.itemPlaceholder}
              value={formText}
            />
            <div className="mt-3 flex gap-2">
              <Button
                disabled={!formText.trim() || isSaving}
                onClick={handleSaveItem}
                size="sm"
              >
                {labels.save}
              </Button>
              <Button
                disabled={isSaving}
                onClick={closeForm}
                size="sm"
                variant="outline"
              >
                {labels.cancel}
              </Button>
            </div>
          </div>
        )}

        {items.map((item, index) =>
          editingIndex === index ? (
            <div
              className="rounded-lg border border-primary p-4"
              key={`edit-${index.toString()}`}
            >
              <Textarea
                className="min-h-[120px] resize-y"
                maxLength={maxItemLength}
                onChange={(e) => setFormText(e.target.value)}
                placeholder={labels.itemPlaceholder}
                value={formText}
              />
              <div className="mt-3 flex gap-2">
                <Button
                  disabled={!formText.trim() || isSaving}
                  onClick={handleSaveItem}
                  size="sm"
                >
                  {labels.save}
                </Button>
                <Button
                  disabled={isSaving}
                  onClick={closeForm}
                  size="sm"
                  variant="outline"
                >
                  {labels.cancel}
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="group flex items-start gap-3 rounded-lg border p-4"
              key={`item-${index.toString()}`}
            >
              <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm">
                {item}
              </p>
              <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  onClick={() => openEdit(index)}
                  size="icon"
                  title={labels.editItem}
                  variant="ghost"
                >
                  <PenIcon size={16} />
                </Button>
                <Button
                  onClick={() => setDeleteItemIndex(index)}
                  size="icon"
                  title={labels.deleteItem}
                  variant="ghost"
                >
                  <TrashIcon size={16} />
                </Button>
              </div>
            </div>
          )
        )}
      </div>

      {/* Delete item confirmation */}
      <AlertDialog
        onOpenChange={(open) => !open && setDeleteItemIndex(null)}
        open={deleteItemIndex !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{labels.deleteItemConfirm}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{labels.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem}>
              {labels.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete entity confirmation */}
      <AlertDialog
        onOpenChange={(open) => !open && setDeleteEntityOpen(false)}
        open={deleteEntityOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{labels.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {labels.deleteConfirmDescription(entity.name)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{labels.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEntity}>
              {labels.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
