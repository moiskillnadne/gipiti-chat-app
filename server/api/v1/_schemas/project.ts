import { z } from "zod/v4";

import { openEnum } from "@/server/api/_kit/open-enum";

/** The swatches a client may choose today. The stored value is free text. */
export const KNOWN_PROJECT_SWATCHES = [
  "sw1",
  "sw2",
  "sw3",
  "sw4",
  "sw5",
  "sw6",
] as const;

/** `data.reason` of a 409 from `POST /projects`. */
export const KNOWN_PROJECT_CONFLICT_REASONS = [
  "project_limit_reached",
] as const;

export const projectConflictDataSchema = z.object({
  reason: openEnum(KNOWN_PROJECT_CONFLICT_REASONS),
  limit: z.number().int().meta({
    description: "How many projects a user may have.",
  }),
});

const MAX_NAME_LENGTH = 128;
const MAX_DESCRIPTION_LENGTH = 280;
const MAX_CONTEXT_ENTRIES = 20;
const MAX_CONTEXT_ENTRY_LENGTH = 2000;

export const projectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  swatch: openEnum(KNOWN_PROJECT_SWATCHES).nullable(),
  contextEntries: z.array(z.string()).meta({
    description:
      "Notes the model is given in every chat of the project, in order.",
  }),
  isDefault: z.boolean().meta({
    description:
      "The project new chats start in. At most one project of a user is the default; none is allowed.",
  }),
  pinned: z.boolean(),
  usageCount: z.number().int(),
  createdAt: z.string().meta({ description: "ISO 8601, UTC." }),
  updatedAt: z.string().meta({ description: "ISO 8601, UTC." }),
});

export type ProjectDto = z.infer<typeof projectSchema>;

export const projectListSchema = z.object({ items: z.array(projectSchema) });

export const projectIdInputSchema = z.object({ projectId: z.uuid() });

/** Postgres refuses a NUL character in text, which would be a 500. */
const hasNoNul = (value: string): boolean => !value.includes("\u0000");
const NUL_MESSAGE = "Must not contain a NUL character.";

const nameField = z
  .string()
  .min(1)
  .max(MAX_NAME_LENGTH)
  .refine(hasNoNul, NUL_MESSAGE);
const descriptionField = z
  .string()
  .max(MAX_DESCRIPTION_LENGTH)
  .refine(hasNoNul, NUL_MESSAGE)
  .nullable();
const swatchField = z.enum(KNOWN_PROJECT_SWATCHES).nullable();
const contextEntriesField = z
  .array(
    z
      .string()
      .min(1)
      .max(MAX_CONTEXT_ENTRY_LENGTH)
      .refine(hasNoNul, NUL_MESSAGE)
  )
  .max(MAX_CONTEXT_ENTRIES);

/** Unknown fields are ignored, as in every other v1 input. */
export const createProjectInputSchema = z.object({
  name: nameField,
  description: descriptionField.optional(),
  swatch: swatchField.optional(),
  contextEntries: contextEntriesField.optional().meta({
    description: "Defaults to no entries.",
  }),
  isDefault: z.boolean().optional().meta({
    description:
      "`true` makes this the default project and clears the flag on the others, in one step.",
  }),
});

/** Any subset: a field that is absent is left as it is. */
export const updateProjectInputSchema = projectIdInputSchema.extend({
  name: nameField.optional(),
  description: descriptionField.optional().meta({
    description: "`null` clears the description.",
  }),
  swatch: swatchField.optional().meta({ description: "`null` clears it." }),
  contextEntries: contextEntriesField.optional(),
  isDefault: z.boolean().optional().meta({
    description:
      "`true` moves the default to this project; `false` leaves the user without one.",
  }),
  pinned: z.boolean().optional(),
});
