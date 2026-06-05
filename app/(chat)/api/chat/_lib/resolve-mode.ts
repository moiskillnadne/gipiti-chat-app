import {
  isImageGenerationModel,
  isVideoGenerationModel,
} from "@/lib/ai/models";

export type ChatMode = "image" | "video" | "text";

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
