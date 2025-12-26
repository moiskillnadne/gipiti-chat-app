import { put } from "@vercel/blob";
import { streamText, tool, type UIMessageStreamWriter } from "ai";
import z from "zod/v4";
import {
  getActiveUserSubscription,
  insertImageGenerationUsageLog,
  saveDocument,
} from "../../db/queries";
import type { ChatMessage } from "../../types";
import { generateUUID } from "../../utils";

async function uploadGeneratedImage(
  base64Data: string,
  mediaType: string
): Promise<string> {
  const buffer = Buffer.from(base64Data, "base64");
  const extension = mediaType.split("/").at(1) ?? "png";
  const filename = `generated-${generateUUID()}.${extension}`;

  const { url } = await put(filename, buffer, { access: "public" });
  return url;
}

type ImageUsageMetadata = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
};

export type ImageGenerationUsageAccumulator = {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  generationCount: number;
};

export function createImageUsageAccumulator(): ImageGenerationUsageAccumulator {
  return {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCost: 0,
    generationCount: 0,
  };
}

type GenerateImageProps = {
  dataStream: UIMessageStreamWriter<ChatMessage>;
  userId: string;
  chatId: string;
  usageAccumulator?: ImageGenerationUsageAccumulator;
};

type GeneratedFileWithBase64 = {
  base64Data?: string;
  mediaType: string;
};

const IMAGE_MODEL_ID = "google/gemini-3-pro-image";

export const generateImageTool = ({
  dataStream,
  userId,
  chatId,
  usageAccumulator,
}: GenerateImageProps) =>
  tool({
    description:
      "Tool for image generation. Use it when you want to generate an image from a prompt.",
    inputSchema: z.object({
      prompt: z.string(),
      modelId: z.string(),
    }),
    execute: async ({ prompt }) => {
      const id = generateUUID();
      let imageUrl: string | undefined;
      let usageMetadata: ImageUsageMetadata | undefined;
      let totalCostUsd: string | undefined;

      dataStream.write({
        type: "data-kind",
        data: "image",
        transient: true,
      });

      dataStream.write({
        type: "data-id",
        data: id,
        transient: true,
      });

      dataStream.write({
        type: "data-title",
        data: prompt,
        transient: true,
      });

      const result = streamText({
        model: IMAGE_MODEL_ID,
        prompt,
      });

      for await (const delta of result.fullStream) {
        const { type } = delta;

        if (type === "start") {
          dataStream.write({
            type: "data-textDelta",
            data: "Start generating image...",
          });
        }

        if (type === "text-delta") {
          const { text } = delta;
          dataStream.write({
            type: "data-textDelta",
            data: text,
            transient: true,
          });
        }

        if (type === "reasoning-delta") {
          const { text } = delta;
          dataStream.write({
            type: "data-textDelta",
            data: text,
            transient: true,
          });
        }

        if (type === "file") {
          dataStream.write({
            type: "data-textDelta",
            data: "Uploading image...",
            transient: true,
          });
          const file = delta.file as GeneratedFileWithBase64;
          if (file.base64Data) {
            imageUrl = await uploadGeneratedImage(
              file.base64Data,
              file.mediaType
            );
          }
        }

        if (type === "finish-step") {
          const metadata = await result.providerMetadata;

          if (metadata) {
            usageMetadata = metadata.google
              ?.usageMetadata as ImageUsageMetadata;
            totalCostUsd = metadata.gateway?.cost?.toString();
          }
        }
      }

      dataStream.write({
        type: "data-clear",
        data: null,
        transient: true,
      });

      dataStream.write({ type: "data-finish", data: null, transient: true });

      if (imageUrl) {
        await saveDocument({
          id,
          title: prompt,
          content: imageUrl,
          kind: "image",
          userId,
        });
      }

      // Update accumulator for merged usage tracking
      if (usageAccumulator) {
        const inputTokens = usageMetadata?.promptTokenCount ?? 0;
        const outputTokens =
          (usageMetadata?.candidatesTokenCount ?? 0) +
          (usageMetadata?.thoughtsTokenCount ?? 0);
        const cost = totalCostUsd ? Number.parseFloat(totalCostUsd) : 0;

        usageAccumulator.totalInputTokens += inputTokens;
        usageAccumulator.totalOutputTokens += outputTokens;
        usageAccumulator.totalCost += cost;
        usageAccumulator.generationCount += 1;
      }

      // Record usage to database
      try {
        const subscription = await getActiveUserSubscription({ userId });

        let billingPeriodStart: Date;
        let billingPeriodEnd: Date;
        let billingPeriodType: "daily" | "weekly" | "monthly" | "annual";

        if (subscription) {
          billingPeriodStart = subscription.currentPeriodStart;
          billingPeriodEnd = subscription.currentPeriodEnd;
          billingPeriodType = subscription.billingPeriod;
        } else {
          const now = new Date();
          billingPeriodStart = new Date(now);
          billingPeriodStart.setHours(0, 0, 0, 0);
          billingPeriodEnd = new Date(now);
          billingPeriodEnd.setHours(23, 59, 59, 999);
          billingPeriodType = "daily";
        }

        await insertImageGenerationUsageLog({
          userId,
          chatId,
          modelId: IMAGE_MODEL_ID,
          prompt,
          imageUrl: imageUrl ?? null,
          generationId: null,
          success: Boolean(imageUrl),
          promptTokens: usageMetadata?.promptTokenCount ?? 0,
          candidatesTokens: usageMetadata?.candidatesTokenCount ?? 0,
          thoughtsTokens: usageMetadata?.thoughtsTokenCount ?? 0,
          totalTokens: usageMetadata?.totalTokenCount ?? 0,
          totalCostUsd: totalCostUsd ?? null,
          billingPeriodType,
          billingPeriodStart,
          billingPeriodEnd,
        });
      } catch (err) {
        console.warn("Failed to record image generation usage", err);
      }

      return {
        id,
        imageUrl,
        content: imageUrl
          ? "Image was generated and uploaded successfully."
          : "Failed to generate image.",
      };
    },
  });

export const generateImage = generateImageTool;
