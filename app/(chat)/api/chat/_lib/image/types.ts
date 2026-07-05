import type { ImageGenSetting } from "@/lib/ai/models";
import type { ChatMessage } from "@/lib/types";

/**
 * Google/Gemini-style usage shape, forwarded verbatim on the
 * imageGenerationFinish stream event.
 */
export type ImageUsageMetadata = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
};

export type ImageGenInput = {
  modelId: string;
  prompt: string;
  settings: ImageGenSetting | undefined;
  previousGenerationId?: string;
  uiMessages: ChatMessage[];
  /** Forward a status or reasoning line to the UI stream (reasoning-delta). */
  onReasoning: (text: string) => void;
};

export type ImageGenResult = {
  base64?: string;
  mediaType?: string;
  usageMetadata?: ImageUsageMetadata;
  costUsd: number;
  responseId?: string;
};

/** Generate (or edit) an image and return its bytes + usage. No side effects. */
export type ImageProvider = (input: ImageGenInput) => Promise<ImageGenResult>;

/**
 * Image generation failed with a message that is safe to show on the media
 * card (e.g. the model's own textual reply when it refuses to draw). Internal
 * provider errors stay generic on the card and only go to the server log.
 */
export class ImageGenerationError extends Error {
  readonly userMessage?: string;

  constructor(message: string, userMessage?: string) {
    super(message);
    this.name = "ImageGenerationError";
    this.userMessage = userMessage;
  }
}
