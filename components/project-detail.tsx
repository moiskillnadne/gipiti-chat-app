"use client";

import type { Project, ProjectFile } from "@/lib/db/schema";

import { EditorV1 } from "./styles-projects/editor-v1";

export function ProjectDetail({
  initialProject,
  initialFiles,
}: {
  initialProject: Project;
  initialFiles: ProjectFile[];
}) {
  return (
    <EditorV1
      initialEntity={initialProject}
      initialFiles={initialFiles}
      kind="project"
    />
  );
}
