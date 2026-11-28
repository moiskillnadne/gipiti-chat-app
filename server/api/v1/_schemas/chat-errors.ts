import { chatListBadRequestDataSchema } from "@/server/api/v1/_schemas/chat";

/** The error of `GET /chats` that says why in `data.reason`. */

export const chatListBadRequestWithReason = {
  BAD_REQUEST: {
    status: 400,
    message: "The request cannot be accepted.",
    data: chatListBadRequestDataSchema,
  },
} as const;
