import {
  quizBadRequestDataSchema,
  quizForbiddenDataSchema,
} from "@/server/api/v1/_schemas/quiz";

/** The errors of `PUT /me/quizzes/{quizKey}` that say why in `data.reason`. */

export const quizBadRequestWithReason = {
  BAD_REQUEST: {
    status: 400,
    message: "The answers cannot be accepted.",
    data: quizBadRequestDataSchema,
  },
} as const;

export const quizForbiddenWithReason = {
  FORBIDDEN: {
    status: 403,
    message: "This action is not allowed.",
    data: quizForbiddenDataSchema,
  },
} as const;
