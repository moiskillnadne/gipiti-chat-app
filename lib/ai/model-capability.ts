import type { ChatModel } from "./models";

export type ModelCapabilityKey = "text" | "code" | "image" | "video";

export const CAPABILITY_KEYS: readonly ModelCapabilityKey[] = [
  "text",
  "code",
  "image",
  "video",
];

const CODE_PATTERN = /codex|code|sonnet|opus|gpt-5\.4|gemini-3|grok/i;

export type ModelCapabilityFlags = Record<ModelCapabilityKey, boolean>;

export function getModelCapabilityFlags(
  model: ChatModel
): ModelCapabilityFlags {
  const isImage = model.capabilities?.imageGeneration === true;
  const isVideo = model.capabilities?.videoGeneration === true;
  const isText = !(isImage || isVideo);
  const isCode = isText && CODE_PATTERN.test(model.id);

  return {
    text: isText,
    code: isCode,
    image: isImage,
    video: isVideo,
  };
}

export function modelMatchesCapabilities(
  model: ChatModel,
  caps: ReadonlySet<ModelCapabilityKey>
): boolean {
  if (caps.size === 0) {
    return true;
  }
  const flags = getModelCapabilityFlags(model);
  for (const cap of caps) {
    if (!flags[cap]) {
      return false;
    }
  }
  return true;
}
