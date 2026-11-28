import { projectConflictDataSchema } from "@/server/api/v1/_schemas/project";

/** The error of `POST /projects` that says why in `data.reason`. */
export const projectCreateConflictWithReason = {
  CONFLICT: {
    status: 409,
    message: "The project limit is reached.",
    data: projectConflictDataSchema,
  },
} as const;
