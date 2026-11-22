import {
  badRequestReasonDataSchema,
  conflictReasonDataSchema,
  forbiddenReasonDataSchema,
  tooManyRequestsDataSchema,
  unauthorizedReasonDataSchema,
} from "@/server/api/v1/_schemas/auth";

/**
 * The errors of the auth endpoints. Unlike the plain ones in
 * `_kit/common-errors`, each says why in `data.reason`, an open enum a
 * client can switch on; `message` is for logs, not for the user.
 */

export const unauthorizedWithReason = {
  UNAUTHORIZED: {
    status: 401,
    message: "Authentication failed.",
    data: unauthorizedReasonDataSchema,
  },
} as const;

export const badRequestWithReason = {
  BAD_REQUEST: {
    status: 400,
    message: "The request cannot be carried out.",
    data: badRequestReasonDataSchema,
  },
} as const;

export const conflictWithReason = {
  CONFLICT: {
    status: 409,
    message: "The request conflicts with the state of the account.",
    data: conflictReasonDataSchema,
  },
} as const;

export const forbiddenWithReason = {
  FORBIDDEN: {
    status: 403,
    message: "This action is not allowed.",
    data: forbiddenReasonDataSchema,
  },
} as const;

export const tooManyRequestsWithRetry = {
  TOO_MANY_REQUESTS: {
    status: 429,
    message: "Too many requests. Try again later.",
    data: tooManyRequestsDataSchema,
  },
} as const;
