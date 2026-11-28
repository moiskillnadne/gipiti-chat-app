import type { ProjectDto } from "@/server/api/v1/_schemas/project";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  swatch: string | null;
  contextEntries: string[];
  isDefault: boolean;
  pinned: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
};

/** Leaves out the owner, which a client already knows. */
export const toProjectDto = (row: ProjectRow): ProjectDto => ({
  id: row.id,
  name: row.name,
  description: row.description,
  swatch: row.swatch,
  contextEntries: row.contextEntries,
  isDefault: row.isDefault,
  pinned: row.pinned,
  usageCount: row.usageCount,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});
