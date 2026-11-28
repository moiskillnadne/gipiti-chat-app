import { getApiErrorCode } from "@/client/shared/api/errors";

const NOT_FOUND_CODE = "NOT_FOUND";

/**
 * Whether an edit may go on after the delete of the old message and the later
 * ones failed. A 404 means there is nothing to delete: the chat row does not
 * exist (its first turn was refused before it was saved, or it was deleted in
 * another tab), and the resend creates it. Any other failure keeps the editor
 * open with the draft.
 */
export const canEditProceedAfterDeleteError = (error: unknown): boolean =>
  getApiErrorCode(error) === NOT_FOUND_CODE;
