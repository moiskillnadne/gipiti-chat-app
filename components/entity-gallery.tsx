"use client";

import { ArrowUpRight, Pin, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

import { useTranslations } from "@/lib/i18n/translate";
import { getSwatchClass } from "@/lib/utils/swatch";

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
import { Kbd } from "./ui/kbd";
import { Label } from "./ui/label";
import { SegmentedControl, SegmentedControlItem } from "./ui/segmented-control";

const RECENT_DAYS = 14;
const RECENT_MS = RECENT_DAYS * 24 * 60 * 60 * 1000;
const MAX_NAME_LENGTH = 128;

export type EntityKind = "style" | "project";

export type GalleryEntity = {
  id: string;
  name: string;
  isDefault: boolean;
  pinned: boolean;
  usageCount: number;
  createdAt: Date | string;
};

export type GalleryTemplate = {
  id: string;
  nameKey: string;
  previewKey: string;
  payload: Record<string, unknown>;
};

export type EntityGalleryLabels = {
  title: string;
  headlineEm: string;
  description: string;
  eyebrow: (params: { count: number; tplCount: number }) => string;
  importLabel: string;
  createCta: string;
  yourEntities: string;
  newCardLabel: string;
  newCardHint: string;
  searchPlaceholder: string;
  filterAll: string;
  filterPinned: string;
  filterRecent: string;
  sortBy: string;
  sortByUses: string;
  sortByName: string;
  sortByDate: string;
  usesLabel: string;
  itemCount: (count: number) => string;
  defaultBadge: string;
  templatesHeading: string;
  templatesHint: string;
  emptyFilteredTitle: string;
  emptyFilteredDescription: string;
  pin: string;
  unpin: string;
  saveError: string;
  deleteSuccess: string;
  deleteError: string;
  deleteConfirmTitle: string;
  deleteConfirmDescription: (name: string) => string;
  cancel: string;
  save: string;
  delete: string;
  entityName: string;
  namePlaceholder: string;
};

export type EntityGalleryConfig<T extends GalleryEntity> = {
  kind: EntityKind;
  apiEndpoint: string;
  detailRoute: (id: string) => string;
  entities: T[];
  isLoading: boolean;
  refreshEntities: () => void;
  getPreview: (item: T) => string | undefined;
  getItemCount: (item: T) => number;
  templates: readonly GalleryTemplate[];
  templateNamespace: "textStyles" | "projects";
};

type FilterValue = "all" | "pinned" | "recent";
type SortValue = "uses" | "name" | "date";

type EntityGalleryProps<T extends GalleryEntity> = {
  config: EntityGalleryConfig<T>;
  labels: EntityGalleryLabels;
};

export function EntityGallery<T extends GalleryEntity>({
  config,
  labels,
}: EntityGalleryProps<T>) {
  const router = useRouter();
  const {
    kind,
    apiEndpoint,
    detailRoute,
    entities,
    refreshEntities,
    getPreview,
    getItemCount,
    templates,
    templateNamespace,
  } = config;

  const tTemplates = useTranslations(templateNamespace);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [sort, setSort] = useState<SortValue>("uses");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);

  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = Date.now();
    return entities
      .filter((item) => {
        if (term && !item.name.toLowerCase().includes(term)) {
          return false;
        }
        if (filter === "pinned") {
          return item.pinned;
        }
        if (filter === "recent") {
          const created = new Date(item.createdAt).getTime();
          return now - created < RECENT_MS;
        }
        return true;
      })
      .slice()
      .sort((a, b) => {
        if (sort === "name") {
          return a.name.localeCompare(b.name, "ru");
        }
        if (sort === "date") {
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        }
        return b.usageCount - a.usageCount;
      });
  }, [entities, search, filter, sort]);

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
      const created: { id: string } = await response.json();
      refreshEntities();
      setIsCreateOpen(false);
      setCreateName("");
      router.push(detailRoute(created.id));
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

  const handleTemplateClick = useCallback(
    async (template: GalleryTemplate) => {
      try {
        const name = tTemplates(template.nameKey);
        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, ...template.payload }),
        });
        if (!response.ok) {
          throw new Error("Failed to create from template");
        }
        const created: { id: string } = await response.json();
        refreshEntities();
        router.push(detailRoute(created.id));
      } catch {
        toast({ type: "error", description: labels.saveError });
      }
    },
    [
      apiEndpoint,
      refreshEntities,
      router,
      detailRoute,
      tTemplates,
      labels.saveError,
    ]
  );

  const handleTogglePin = useCallback(
    async (item: T) => {
      try {
        const response = await fetch(apiEndpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id, pinned: !item.pinned }),
        });
        if (!response.ok) {
          throw new Error("Failed to toggle pin");
        }
        refreshEntities();
      } catch {
        toast({ type: "error", description: labels.saveError });
      }
    },
    [apiEndpoint, refreshEntities, labels.saveError]
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }
    try {
      await fetch(`${apiEndpoint}?id=${deleteTarget.id}`, { method: "DELETE" });
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

  const eyebrowText = labels.eyebrow({
    count: entities.length,
    tplCount: templates.length,
  });

  const closeCreate = () => {
    setIsCreateOpen(false);
    setCreateName("");
  };

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-[18px] px-7 py-6 pb-20">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1.5 font-mono text-[10px] text-ink-3 uppercase tracking-[0.1em]">
            {eyebrowText}
          </div>
          <h1 className="font-light text-[26px] text-ink leading-[1.1] tracking-[-0.02em]">
            {labels.title}{" "}
            <em className="font-extralight text-ink-2 italic">
              {labels.headlineEm}
            </em>
          </h1>
          <p className="mt-1 max-w-[520px] text-[13px] text-ink-3">
            {labels.description}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <Button size="sm" variant="outline">
            {labels.importLabel}
          </Button>
          <Button onClick={() => setIsCreateOpen(true)} size="sm">
            <Plus className="size-3.5" />
            {labels.createCta}
          </Button>
        </div>
      </div>

      {/* Create dialog */}
      {isCreateOpen ? (
        <div className="rounded-md border border-rule bg-card p-4">
          <h2 className="mb-4 font-medium text-lg">{labels.createCta}</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-entity-name">{labels.entityName}</Label>
              <Input
                id="new-entity-name"
                maxLength={MAX_NAME_LENGTH}
                onChange={(event) => setCreateName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && createName.trim()) {
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
      ) : null}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 border-rule border-b pb-3.5">
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          <div className="inline-flex min-w-[280px] items-center gap-2 rounded-md border border-rule bg-card px-3 py-1.5">
            <Search className="size-3.5 flex-shrink-0 text-ink-4" />
            <input
              className="flex-1 border-0 bg-transparent text-[13px] outline-none placeholder:text-ink-4"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={labels.searchPlaceholder}
              value={search}
            />
            <Kbd>⌘K</Kbd>
          </div>
          <FilterChip
            active={filter === "all"}
            label={labels.filterAll}
            onClick={() => setFilter("all")}
          />
          <FilterChip
            active={filter === "pinned"}
            label={labels.filterPinned}
            onClick={() => setFilter("pinned")}
          />
          <FilterChip
            active={filter === "recent"}
            label={labels.filterRecent}
            onClick={() => setFilter("recent")}
          />
        </div>
        <div className="ml-auto flex flex-shrink-0 items-center gap-2">
          <span className="font-mono text-[11px] text-ink-3 uppercase tracking-[0.06em]">
            {labels.sortBy}
          </span>
          <SegmentedControl
            onValueChange={(value) => setSort(value as SortValue)}
            value={sort}
          >
            <SegmentedControlItem value="uses">
              {labels.sortByUses}
            </SegmentedControlItem>
            <SegmentedControlItem value="name">
              {labels.sortByName}
            </SegmentedControlItem>
            <SegmentedControlItem value="date">
              {labels.sortByDate}
            </SegmentedControlItem>
          </SegmentedControl>
        </div>
      </div>

      {/* Cards section */}
      <SectionHeading count={visibleItems.length} title={labels.yourEntities} />
      {visibleItems.length === 0 ? (
        <EmptyState
          description={labels.emptyFilteredDescription}
          title={labels.emptyFilteredTitle}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {visibleItems.map((item) => (
            <EntityCard
              defaultBadge={labels.defaultBadge}
              detailRoute={detailRoute}
              getItemCount={getItemCount}
              getPreview={getPreview}
              item={item}
              itemCount={getItemCount(item)}
              itemCountLabel={labels.itemCount}
              key={item.id}
              kind={kind}
              onTogglePin={handleTogglePin}
              pinTitle={item.pinned ? labels.unpin : labels.pin}
              usesLabel={labels.usesLabel}
            />
          ))}
          <NewCard
            hint={labels.newCardHint}
            label={labels.newCardLabel}
            onClick={() => setIsCreateOpen(true)}
          />
        </div>
      )}

      {/* Templates */}
      {templates.length > 0 ? (
        <div className="mt-1.5">
          <SectionHeading
            hint={labels.templatesHint}
            title={labels.templatesHeading}
          />
          <div className="mt-2.5 grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
            {templates.map((template, idx) => (
              <TemplateCard
                index={idx}
                key={template.id}
                kind={kind}
                name={tTemplates(template.nameKey)}
                onClick={() => handleTemplateClick(template)}
                preview={tTemplates(template.previewKey)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
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

type FilterChipProps = {
  active: boolean;
  label: string;
  onClick: () => void;
};

function FilterChip({ active, label, onClick }: FilterChipProps) {
  return (
    <button
      className={
        active
          ? "inline-flex items-center gap-1 rounded-pill border border-ink bg-ink px-2.5 py-[3px] font-mono text-[11px] text-paper uppercase tracking-[0.04em]"
          : "inline-flex items-center gap-1 rounded-pill border border-rule bg-card px-2.5 py-[3px] font-mono text-[11px] text-ink-3 uppercase tracking-[0.04em] transition-colors duration-fast ease-canon hover:border-rule-strong hover:text-ink"
      }
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

type SectionHeadingProps = {
  title: string;
  count?: number;
  hint?: string;
};

function SectionHeading({ title, count, hint }: SectionHeadingProps) {
  return (
    <div className="flex items-baseline gap-2.5">
      <h2 className="font-medium font-mono text-[12px] text-ink-3 uppercase tracking-[0.08em]">
        {title}
      </h2>
      {typeof count === "number" ? (
        <span className="font-mono text-[11px] text-ink-4">{count}</span>
      ) : null}
      {hint ? (
        <span className="text-[11px] text-ink-4 italic">{hint}</span>
      ) : null}
    </div>
  );
}

type EmptyStateProps = {
  title: string;
  description: string;
};

function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-rule-strong border-dashed px-6 py-12 text-center text-ink-3">
      <h3 className="mb-1 font-medium text-[15px] text-ink">{title}</h3>
      <p className="text-[13px]">{description}</p>
    </div>
  );
}

type EntityCardProps<T extends GalleryEntity> = {
  item: T;
  kind: EntityKind;
  itemCount: number;
  itemCountLabel: (count: number) => string;
  detailRoute: (id: string) => string;
  getPreview: (item: T) => string | undefined;
  getItemCount: (item: T) => number;
  onTogglePin: (item: T) => void;
  defaultBadge: string;
  usesLabel: string;
  pinTitle: string;
};

function EntityCard<T extends GalleryEntity>({
  item,
  kind,
  itemCount,
  itemCountLabel,
  detailRoute,
  getPreview,
  onTogglePin,
  defaultBadge,
  usesLabel,
  pinTitle,
}: EntityCardProps<T>) {
  const router = useRouter();
  const preview = getPreview(item);
  const swatch = getSwatchClass(item.id);

  const navigate = () => router.push(detailRoute(item.id));

  return (
    // biome-ignore lint/a11y/useSemanticElements: nested <button> (pin toggle) makes a real <button> invalid HTML
    <div
      className="group hover:-translate-y-px relative flex min-h-[168px] cursor-pointer flex-col gap-2.5 rounded-lg border border-rule bg-card p-[18px] transition-[border-color,transform] duration-fast ease-canon hover:border-rule-strong"
      onClick={navigate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <button
        aria-label={pinTitle}
        className={
          item.pinned
            ? "absolute top-3 right-3 inline-flex size-6 items-center justify-center rounded-sm text-citrus-deep"
            : "absolute top-3 right-3 inline-flex size-6 items-center justify-center rounded-sm text-ink-4 opacity-0 transition-opacity duration-fast ease-canon hover:bg-paper-2 hover:text-ink group-focus-within:opacity-100 group-hover:opacity-100"
        }
        onClick={(event) => {
          event.stopPropagation();
          onTogglePin(item);
        }}
        title={pinTitle}
        type="button"
      >
        <Pin
          className="size-3.5"
          fill={item.pinned ? "currentColor" : "none"}
        />
      </button>

      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className={`entity-swatch ${kind} ${swatch} size-[26px]`}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-medium text-[15px] text-ink tracking-[-0.01em]">
            {item.name}
          </span>
          <span className="font-mono text-[11px] text-ink-3">
            {itemCountLabel(itemCount)}
          </span>
        </div>
      </div>

      <div className="line-clamp-3 flex-1 text-[12.5px] text-ink-3 italic leading-[1.5]">
        {preview ? (
          <>
            {kind === "style" ? <span className="text-ink-4">“</span> : null}
            {preview}
            {kind === "style" ? <span className="text-ink-4">”</span> : null}
          </>
        ) : (
          <span className="text-ink-4 not-italic">—</span>
        )}
      </div>

      <div className="flex items-center justify-between border-rule border-t border-dashed pt-2.5 font-mono text-[10px] text-ink-3 uppercase tracking-[0.06em]">
        <span className="inline-flex items-center gap-1">
          <ArrowUpRight className="size-3" />
          <b className="font-medium text-ink-2">{item.usageCount}</b>{" "}
          {usesLabel}
        </span>
        {item.isDefault ? (
          <span className="inline-flex items-center gap-1 rounded-pill bg-citrus-soft px-2 py-[2px] font-medium text-[10px] text-ink normal-case tracking-normal">
            <span className="size-1.5 rounded-full bg-citrus-deep" />
            {defaultBadge}
          </span>
        ) : null}
      </div>
    </div>
  );
}

type NewCardProps = {
  label: string;
  hint: string;
  onClick: () => void;
};

function NewCard({ label, hint, onClick }: NewCardProps) {
  return (
    <button
      className="flex min-h-[168px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-rule-strong border-dashed text-ink-3 transition-colors duration-fast ease-canon hover:border-ink hover:bg-paper hover:text-ink"
      onClick={onClick}
      type="button"
    >
      <Plus className="size-4" />
      <span className="font-medium text-[13px]">{label}</span>
      <span className="text-[11px] text-ink-4">{hint}</span>
    </button>
  );
}

type TemplateCardProps = {
  name: string;
  preview: string;
  kind: EntityKind;
  index: number;
  onClick: () => void;
};

function TemplateCard({
  name,
  preview,
  kind,
  index,
  onClick,
}: TemplateCardProps) {
  const swatch = getSwatchClass(`template-${kind}-${index}`);
  return (
    <button
      className="group flex min-h-[120px] cursor-pointer flex-col gap-2 rounded-lg border border-rule-strong border-dashed bg-gradient-to-b from-paper to-card p-[18px] text-left transition-colors duration-fast ease-canon hover:border-ink hover:border-solid"
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={`entity-swatch ${kind} ${swatch} size-[22px]`}
        />
        <span className="truncate font-medium text-[14px] text-ink tracking-[-0.01em]">
          {name}
        </span>
      </div>
      <p className="line-clamp-2 text-[12px] text-ink-2 leading-[1.5]">
        {preview}
      </p>
    </button>
  );
}

type ContextNode = ReactNode;
export type { ContextNode };
