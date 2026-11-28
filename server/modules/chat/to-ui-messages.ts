import type { UIMessagePart } from "ai";
import { formatISO } from "date-fns";

import type { ChatMessage, ChatTools, CustomUIDataTypes } from "@/lib/types";
import type { DBMessage } from "@/server/db/schema";

/**
 * Maps stored `Message_v2` rows to the UI messages the chat renders and the
 * model receives: row `createdAt` and `modelId` move into `metadata`.
 */
export const convertToUIMessages = (messages: DBMessage[]): ChatMessage[] =>
  messages.map((message) => ({
    id: message.id,
    role: message.role as "user" | "assistant" | "system",
    parts: message.parts as UIMessagePart<CustomUIDataTypes, ChatTools>[],
    metadata: {
      createdAt: formatISO(message.createdAt),
      modelId: message.modelId ?? undefined,
    },
  }));
