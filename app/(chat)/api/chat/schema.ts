import { z } from "zod";

import { chatModelIds } from "@/lib/ai/models";
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_NAME_LENGTH,
} from "@/lib/attachments/attachment-limits";
import { isAllowedAttachmentUrl } from "@/server/modules/uploads/attachment-fetch-policy";

const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(50_000),
});

const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.enum([
    "image/jpeg",
    "image/png",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/markdown",
    "text/plain",
    "text/csv",
    "text/tab-separated-values",
  ]),
  // Legacy key, still read by the server-side text/docx inliners.
  name: z.string().min(1).max(MAX_ATTACHMENT_NAME_LENGTH),
  // AI SDK field — what the chat UI and the model see as the file name.
  filename: z.string().min(1).max(MAX_ATTACHMENT_NAME_LENGTH).optional(),
  // Original size in bytes; display-only metadata for the attachment card.
  size: z.number().int().nonnegative().max(MAX_ATTACHMENT_BYTES).optional(),
  // Uploads always land in the app's Blob store; any other URL is refused so
  // the server (and the model gateway) is never pointed at a foreign host.
  url: z.string().url().refine(isAllowedAttachmentUrl, {
    message: "Attachment URL must point to the app's file storage",
  }),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

const chatModelIdSchema = z.enum(chatModelIds as [string, ...string[]]);

const thinkingSettingEffortSchema = z.object({
  type: z.literal("effort"),
  value: z.string(),
});

const thinkingSettingBudgetSchema = z.object({
  type: z.literal("budget"),
  value: z.number(),
});

const thinkingSettingSchema = z.union([
  thinkingSettingEffortSchema,
  thinkingSettingBudgetSchema,
]);

const imageGenSettingSchema = z.object({
  quality: z.string().optional(),
  aspectRatio: z.string().optional(),
});

const videoGenSettingSchema = z.object({
  aspectRatio: z.string().optional(),
  duration: z.string().optional(),
  resolution: z.string().optional(),
  mode: z.string().optional(),
});

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  // Per-send id the client uses to stop exactly this turn (regenerate and edit
  // re-send the same user message, so the message id cannot tell turns apart).
  // Optional so older clients keep working: the server then uses message.id.
  turnId: z.string().uuid().optional(),
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(["user"]),
    parts: z.array(partSchema),
  }),
  selectedChatModel: chatModelIdSchema,
  thinkingSetting: thinkingSettingSchema.optional(),
  imageGenSetting: imageGenSettingSchema.optional(),
  videoGenSetting: videoGenSettingSchema.optional(),
  previousGenerationId: z.string().optional(),
  selectedProjectId: z.string().uuid().optional(),
  webSearchEnabled: z.boolean().optional(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
