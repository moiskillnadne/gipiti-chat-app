"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";

import { TrashIcon } from "./icons";
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

type EntityBase = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type EntityManagerLabels = {
  title: string;
  pageDescription: string;
  createEntity: string;
  entityName: string;
  namePlaceholder: string;
  defaultBadge: string;
  itemCount: (count: number) => string;
  noEntitiesYet: string;
  noEntitiesDescription: string;
  saveError: string;
  deleteSuccess: string;
  deleteError: string;
  deleteConfirmTitle: string;
  deleteConfirmDescription: (name: string) => string;
  back: string;
  save: string;
  cancel: string;
  delete: string;
};

export type EntityManagerConfig<T extends EntityBase> = {
  apiEndpoint: string;
  detailRoute: (id: string) => string;
  entities: T[];
  isLoading: boolean;
  refreshEntities: () => void;
  getItemCount: (entity: T) => number;
  emptyIcon: ReactNode;
};

type EntityManagerProps<T extends EntityBase> = {
  config: EntityManagerConfig<T>;
  labels: EntityManagerLabels;
};

export function EntityManager<T extends EntityBase>({
  config,
  labels,
}: EntityManagerProps<T>) {
  const router = useRouter();
  const {
    apiEndpoint,
    detailRoute,
    entities,
    isLoading,
    refreshEntities,
    getItemCount,
    emptyIcon,
  } = config;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);

  const handleCreate = useCallback(async () => {
    const trimmedName = createName.trim();
    if (!trimmedName || isCreating) {
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });

      if (!response.ok) {
        throw new Error("Failed to create entity");
      }

      const newEntity: { id: string } = await response.json();
      refreshEntities();
      setIsCreateOpen(false);
      setCreateName("");
      router.push(detailRoute(newEntity.id));
    } catch {
      toast({ type: "error", description: labels.saveError });
    } finally {
      setIsCreating(false);
    }
  }, [
    createName,
    isCreating,
    apiEndpoint,
    refreshEntities,
    router,
    detailRoute,
    labels.saveError,
  ]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      await fetch(`${apiEndpoint}?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      toast({ type: "success", description: labels.deleteSuccess });
      refreshEntities();
    } catch {
      toast({ type: "error", description: labels.deleteError });
    } finally {
      setDeleteTarget(null);
    }
  }, [
    deleteTarget,
    apiEndpoint,
    refreshEntities,
    labels.deleteSuccess,
    labels.deleteError,
  ]);

  const closeCreate = () => {
    setIsCreateOpen(false);
    setCreateName("");
  };

  return (
    <div className="flex h-dvh flex-col px-4 py-8">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button onClick={() => router.push("/")} size="sm" variant="ghost">
            {labels.back}
          </Button>
          <h1 className="font-semibold text-xl">{labels.title}</h1>
        </div>
        {!isCreateOpen && (
          <Button onClick={() => setIsCreateOpen(true)} size="sm">
            {labels.createEntity}
          </Button>
        )}
      </div>
      <p className="mb-6 text-muted-foreground text-sm">
        {labels.pageDescription}
      </p>

      {/* Create Form */}
      {isCreateOpen && (
        <div className="mb-6 rounded-lg border p-4">
          <h2 className="mb-4 font-medium text-lg">{labels.createEntity}</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-entity-name">{labels.entityName}</Label>
              <Input
                id="new-entity-name"
                maxLength={MAX_NAME_LENGTH}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && createName.trim()) {
                    handleCreate();
                  }
                }}
                placeholder={labels.namePlaceholder}
                value={createName}
              />
            </div>
            <div className="flex gap-2">
              <Button
                disabled={!createName.trim() || isCreating}
                onClick={handleCreate}
                size="sm"
              >
                {labels.save}
              </Button>
              <Button
                disabled={isCreating}
                onClick={closeCreate}
                size="sm"
                variant="outline"
              >
                {labels.cancel}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && entities.length === 0 && !isCreateOpen && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {emptyIcon}
          <p className="mt-4 font-medium text-lg">{labels.noEntitiesYet}</p>
          <p className="mt-1 text-muted-foreground text-sm">
            {labels.noEntitiesDescription}
          </p>
          <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
            {labels.createEntity}
          </Button>
        </div>
      )}

      {/* Entity List */}
      <div className="space-y-3">
        {entities.map((item) => (
          // biome-ignore lint/a11y/useSemanticElements: can't use <button> — contains nested <Button> (delete) which is invalid HTML
          <div
            className="flex w-full cursor-pointer items-center justify-between rounded-lg border p-4 text-left transition-colors hover:bg-muted/50"
            key={item.id}
            onClick={() => router.push(detailRoute(item.id))}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                router.push(detailRoute(item.id));
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{item.name}</span>
                {item.isDefault && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-primary text-xs">
                    {labels.defaultBadge}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-muted-foreground text-sm">
                {labels.itemCount(getItemCount(item))}
              </p>
            </div>

            <Button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(item);
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
            <AlertDialogTitle>{labels.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {labels.deleteConfirmDescription(deleteTarget?.name ?? "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{labels.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {labels.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
