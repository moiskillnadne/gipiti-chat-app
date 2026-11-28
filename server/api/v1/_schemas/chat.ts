import { z } from "zod/v4";

import { openEnum } from "@/server/api/_kit/open-enum";
import {
  pageOutputSchema,
  pageQuerySchema,
} from "@/server/api/_kit/pagination";

/** `data.reason` of a 400 from `GET /chats`. */
export const KNOWN_CHAT_LIST_BAD_REQUEST_REASONS = ["invalid_cursor"] as const;

export const chatListBadRequestDataSchema = z.object({
  reason: openEnum(KNOWN_CHAT_LIST_BAD_REQUEST_REASONS),
});

export const chatSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  createdAt: z.string().meta({ description: "ISO 8601, UTC." }),
});

export type ChatDto = z.infer<typeof chatSchema>;

export const chatListInputSchema = pageQuerySchema;

export const chatListSchema = pageOutputSchema(chatSchema);

export const chatIdInputSchema = z.object({ chatId: z.uuid() });

/**
 * The two DELETE routes that take a query use the `detailed` input structure:
 * for a DELETE, oRPC's default (`compact`) reads what is not in the path from
 * the request body, and these values belong in the query string.
 */
export const deleteAllChatsInputSchema = z.object({
  query: z.object({
    confirm: z.enum(["true"]).meta({
      description:
        "Must be exactly `true`. A guard against deleting every chat by a stray request.",
    }),
  }),
});

export const chatVoteSchema = z.object({
  messageId: z.uuid(),
  isUpvoted: z.boolean().meta({
    description: "`true` for a thumbs up, `false` for a thumbs down.",
  }),
});

export const chatVoteListSchema = z.object({ items: z.array(chatVoteSchema) });

export const setMessageVoteInputSchema = chatIdInputSchema.extend({
  messageId: z.uuid(),
  isUpvoted: z.boolean().meta({
    description: "`true` for a thumbs up, `false` for a thumbs down.",
  }),
});

export const removeMessagesFromInputSchema = z.object({
  params: chatIdInputSchema,
  query: z.object({
    fromMessageId: z.uuid().meta({
      description:
        "This message and every later message of the chat are deleted.",
    }),
  }),
});
