import {
  DEFAULT_CHAT_MODEL,
  isImageGenerationModel,
  isVideoGenerationModel,
  isVisibleInUI,
} from "@/lib/ai/models";

export type ChatMode = "image" | "video" | "text";

/** The model a turn runs on: hidden models fall back to the default model. */
export function resolveRequestedModel(requestedModelId: string): string {
  return isVisibleInUI(requestedModelId)
    ? requestedModelId
    : DEFAULT_CHAT_MODEL;
}

/**
 * Classify the selected model into an inference mode. Direct image/video
 * models bypass the streamText tool path; everything else is text chat.
 */
export function resolveChatMode(modelId: string): ChatMode {
  if (isImageGenerationModel(modelId)) {
    return "image";
  }
  if (isVideoGenerationModel(modelId)) {
    return "video";
  }
  return "text";
}
