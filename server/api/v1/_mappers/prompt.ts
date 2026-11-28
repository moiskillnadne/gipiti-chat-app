import type { PromptDto } from "@/server/api/v1/_schemas/prompt";
import type { Prompt } from "@/server/db/schema";

/** Leaves out what the catalogue uses internally: order, switch, timestamps. */
export const toPromptDto = (row: Prompt): PromptDto => ({
  id: row.id,
  key: row.key,
  category: row.category,
  modelId: row.modelId,
  title: row.title,
  body: row.body,
  tags: row.tags,
});
