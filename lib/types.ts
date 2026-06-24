import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { calculator } from "./ai/tools/calculator";
import type { extractUrl } from "./ai/tools/extract-url";
import type { generateDocxTool } from "./ai/tools/generate-docx";
import type { generateImageTool } from "./ai/tools/generate-image";
import type { generatePdfTool } from "./ai/tools/generate-pdf";
import type { generateXlsxTool } from "./ai/tools/generate-xlsx";
import type { updateXlsxTool } from "./ai/tools/update-xlsx";
import type { webSearch } from "./ai/tools/web-search";
import type { Prompt } from "./db/schema";
import type { AppUsage } from "./usage";

export type DataPart = { type: "append-message"; message: string };

export type PromptsResponse = {
  prompts: Prompt[];
  favoriteIds: string[];
};

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
  modelId: z.string().optional(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type calculatorTool = InferUITool<typeof calculator>;
type webSearchTool = InferUITool<ReturnType<typeof webSearch>>;
type extractUrlTool = InferUITool<ReturnType<typeof extractUrl>>;
type generateImageToolType = InferUITool<ReturnType<typeof generateImageTool>>;
type generatePdfToolType = InferUITool<ReturnType<typeof generatePdfTool>>;
type generateDocxToolType = InferUITool<ReturnType<typeof generateDocxTool>>;
type generateXlsxToolType = InferUITool<ReturnType<typeof generateXlsxTool>>;
type updateXlsxToolType = InferUITool<ReturnType<typeof updateXlsxTool>>;

export type ChatTools = {
  calculator: calculatorTool;
  webSearch: webSearchTool;
  extractUrl: extractUrlTool;
  generateImage: generateImageToolType;
  generatePdf: generatePdfToolType;
  generateDocx: generateDocxToolType;
  generateXlsx: generateXlsxToolType;
  updateXlsx: updateXlsxToolType;
};

export type CustomUIDataTypes = {
  appendMessage: string;
  usage: AppUsage;
  modelId: string;
  imageGenerationFinish: {
    responseId: string;
    imageUrl: string;
    userPrompt: string;
    usageMetadata: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      thoughtsTokenCount?: number;
      totalTokenCount?: number;
    };
  };
  videoGenerationFinish: {
    responseId: string;
    videoUrl: string;
    userPrompt: string;
    durationSeconds: number;
  };
  mediaGeneration: {
    documentId: string;
    mediaType: "image" | "video";
    status: "generating" | "done" | "error";
    prompt: string;
    modelId: string;
    url?: string;
    durationSeconds?: number;
    errorMessage?: string;
    /** Provider generation id (image) — drives multi-turn image editing. */
    generationId?: string;
  };
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};

// Direct image generation message parts (for standalone image models)
export type ImageGeneratingPart = {
  type: "image-generating";
  prompt: string;
};

export type ImageResultPart = {
  type: "image-result";
  imageUrl: string;
  responseId: string;
  prompt: string;
};

export type ImageMetadataPart = {
  type: "image-metadata";
  responseId: string;
};

export type DirectImagePart =
  | ImageGeneratingPart
  | ImageResultPart
  | ImageMetadataPart;

// Payment Intent types
export type PaymentStatus =
  | "pending"
  | "processing"
  | "verifying"
  | "activating"
  | "succeeded"
  | "failed"
  | "expired";

export type PaymentIntentResponse = {
  sessionId: string;
  expiresAt: string;
};

export type PaymentStatusResponse = {
  status: PaymentStatus;
  /** Indicates if the payment intent has any activity (webhook received or status changed from pending) */
  hasActivity?: boolean;
  subscription?: {
    id: string;
    planName: string;
    status: string;
  };
  /** Present when a top-up intent succeeded — lets the success screen show the new balance without an extra fetch. */
  topup?: {
    amountMinor: number;
    currencyCode: string;
    balanceTotalMinor: number;
    balanceTopupMinor: number;
  };
  failureReason?: string;
};

export type TopupIntentResponse = {
  sessionId: string;
  expiresAt: string;
  amountMajor: number;
};
