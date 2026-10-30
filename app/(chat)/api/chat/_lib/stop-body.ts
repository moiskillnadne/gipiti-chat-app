import { z } from "zod";

/**
 * Body of `POST /api/chat/[id]/stop`: the `turnId` of the chat POST to stop.
 * `messageId` is what clients cached from before per-send turn ids still send;
 * it matches the server's fallback `turnId = body.turnId ?? message.id`.
 */
export const stopBodySchema = z
  .object({
    turnId: z.string().uuid().optional(),
    messageId: z.string().uuid().optional(),
  })
  .refine((body) => body.turnId !== undefined || body.messageId !== undefined)
  .transform((body) => ({ turnId: (body.turnId ?? body.messageId) as string }));
