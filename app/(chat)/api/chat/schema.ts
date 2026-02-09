import { z } from "zod";

import { chatModelIds } from "@/lib/ai/models";

const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(3000),
});

const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  name: z.string().min(1).max(100),
  url: z.string().url(),
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

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(["user"]),
    parts: z.array(partSchema),
  }),
  selectedChatModel: chatModelIdSchema,
  thinkingSetting: thinkingSettingSchema.optional(),
  previousGenerationId: z.string().optional(),
  selectedTextStyleId: z.string().uuid().optional(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
