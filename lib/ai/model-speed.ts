import { isImageGenerationModel, isVideoGenerationModel } from "./models";

export type ModelSpeedLevel = 1 | 2 | 3 | 4;

export const SPEED_LABEL_KEY: Record<ModelSpeedLevel, string> = {
  1: "speed.slow",
  2: "speed.reasoning",
  3: "speed.fast",
  4: "speed.instant",
};

const SLOW_PATTERNS = [/veo/i, /opus-4\.6/i, /flux-2-max/i];
const INSTANT_PATTERNS = [
  /nano/i,
  /-instant$/i,
  /flash/i,
  /\b(mini|fast)\b/i,
  /code-fast/i,
];
const REASONING_TOKEN_PATTERN = /codex|reasoning|thinking/i;

export function getModelSpeedLevel(modelId: string): ModelSpeedLevel {
  if (SLOW_PATTERNS.some((p) => p.test(modelId))) {
    return 1;
  }

  const isVideo = isVideoGenerationModel(modelId);
  const isImage = isImageGenerationModel(modelId);
  if (isVideo || isImage) {
    return 2;
  }

  if (REASONING_TOKEN_PATTERN.test(modelId)) {
    return 2;
  }

  if (INSTANT_PATTERNS.some((p) => p.test(modelId))) {
    return 4;
  }

  return 3;
}
