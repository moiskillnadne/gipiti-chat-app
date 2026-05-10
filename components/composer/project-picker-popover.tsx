"use client";

import { Check, ChevronRight, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useProject } from "@/contexts/project-context";
import { useTranslations } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { resolveSwatchClass } from "@/lib/utils/swatch";
import {
  ChipRemoveButton,
  ChipWrapper,
  ContextChipTrigger,
} from "./context-chip";

export function ProjectPickerPopover() {
  const tInput = useTranslations("chat.input");
  const tProjects = useTranslations("projects");
  const { currentProjectId, setProjectId, projects } = useProject();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const currentProject = projects.find(
    (project) => project.id === currentProjectId
  );

  const filteredProjects = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery) {
      return projects;
    }
    return projects.filter((project) =>
      project.name.toLowerCase().includes(trimmedQuery)
    );
  }, [query, projects]);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <ChipWrapper empty={!currentProject}>
        <PopoverTrigger asChild>
          <ContextChipTrigger
            empty={!currentProject}
            kind="project"
            labelKey={tInput("projectPickerLabel")}
            swatchClass={
              currentProject
                ? resolveSwatchClass(currentProject.swatch, currentProject.id)
                : null
            }
            value={currentProject?.name ?? tInput("projectPickerEmpty")}
          />
        </PopoverTrigger>
        {currentProject && (
          <ChipRemoveButton
            label={tInput("removeProject")}
            onRemove={() => setProjectId(null)}
          />
        )}
      </ChipWrapper>
      <PopoverContent
        align="start"
        className="w-80 overflow-hidden rounded-lg border border-rule bg-card p-0 text-popover-foreground shadow-pop"
        sideOffset={6}
      >
        <div className="flex items-center gap-2 border-rule border-b px-3 py-2.5">
          <Search className="size-3.5 text-ink-3" strokeWidth={1.6} />
          <input
            autoFocus
            className="flex-1 border-none bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-4"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tInput("searchProjects")}
            value={query}
          />
          <kbd className="rounded border border-rule bg-paper-2 px-1.5 py-[2px] font-mono text-[9px] text-ink-4 uppercase tracking-[0.04em]">
            esc
          </kbd>
        </div>

        <div className="flex max-h-72 flex-col gap-px overflow-y-auto p-1.5">
          <div className="px-2.5 pt-1.5 pb-1 font-mono text-[9.5px] text-ink-4 uppercase tracking-[0.1em]">
            {tInput("yourProjectsCount", { count: projects.length })}
          </div>

          {filteredProjects.length === 0 && (
            <div className="px-2.5 py-3 text-[12px] text-ink-3">
              {tProjects("noProjectsYetShort")}
            </div>
          )}

          {filteredProjects.map((project) => {
            const isSelected = project.id === currentProjectId;
            return (
              <button
                className={cn(
                  "grid grid-cols-[18px_1fr_auto] items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors duration-fast ease-canon",
                  "hover:bg-paper-2",
                  isSelected && "bg-paper-2"
                )}
                key={project.id}
                onClick={() => {
                  setProjectId(project.id);
                  setOpen(false);
                }}
                type="button"
              >
                <span
                  aria-hidden
                  className={cn(
                    "relative inline-block size-4 shrink-0 rounded-[5px]",
                    resolveSwatchClass(project.swatch, project.id)
                  )}
                >
                  <span
                    aria-hidden
                    className="absolute inset-[3px] rounded-[2px] border-[1.2px] border-ink/50 border-solid"
                  />
                </span>
                <span className="flex min-w-0 flex-col gap-px">
                  <span className="truncate font-medium text-[13px] text-ink">
                    {project.name}
                  </span>
                  {project.description && (
                    <span className="truncate text-[11.5px] text-ink-3">
                      {project.description}
                    </span>
                  )}
                </span>
                {isSelected ? (
                  <Check className="size-3.5 text-ink" strokeWidth={2.4} />
                ) : project.isDefault ? (
                  <span className="font-mono text-[9.5px] text-ink-4 uppercase tracking-[0.06em]">
                    {tProjects("defaultBadge")}
                  </span>
                ) : (
                  <span />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 border-rule border-t bg-paper px-2.5 py-2">
          <Link
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
            href="/projects?create=1"
            onClick={() => setOpen(false)}
          >
            <Plus className="size-3" strokeWidth={1.8} />
            {tInput("newProject")}
          </Link>
          <div className="flex-1" />
          <Link
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
            href="/projects"
            onClick={() => setOpen(false)}
          >
            {tInput("manageProjects")}
            <ChevronRight className="size-3" strokeWidth={1.8} />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
