import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/artifact";
import type { calculator } from "./ai/tools/calculator";
import type { createDocument } from "./ai/tools/create-document";
import type { extractUrl } from "./ai/tools/extract-url";
import type { generateImageTool } from "./ai/tools/generate-image";
import type { getWeather } from "./ai/tools/get-weather";
import type { requestSuggestions } from "./ai/tools/request-suggestions";
import type { updateDocument } from "./ai/tools/update-document";
import type { webSearch } from "./ai/tools/web-search";
import type { Suggestion } from "./db/schema";
import type { AppUsage } from "./usage";

export type DataPart = { type: "append-message"; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type calculatorTool = InferUITool<typeof calculator>;
type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
  ReturnType<typeof requestSuggestions>
>;
type webSearchTool = InferUITool<ReturnType<typeof webSearch>>;
type extractUrlTool = InferUITool<ReturnType<typeof extractUrl>>;
type generateImageToolType = InferUITool<ReturnType<typeof generateImageTool>>;

export type ChatTools = {
  calculator: calculatorTool;
  getWeather: weatherTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
  webSearch: webSearchTool;
  extractUrl: extractUrlTool;
  generateImage: generateImageToolType;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  usage: AppUsage;
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
  subscription?: {
    id: string;
    planName: string;
    status: string;
  };
  failureReason?: string;
};
