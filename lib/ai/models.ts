import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import type { SharedV2ProviderOptions } from "@ai-sdk/provider";

export const DEFAULT_CHAT_MODEL: string = "gpt-5.4-mini";

export type ChatModelCapabilities = {
  reasoning?: boolean;
  attachments?: boolean;
  imageGeneration?: boolean;
  videoGeneration?: boolean;
  /**
   * Whether the model supports function calling. Undefined = supported.
   * Perplexity Sonar models have search built in and reject tool definitions,
   * so they run without the app tool set.
   */
  toolCalling?: boolean;
};

export type ModelProvider =
  | "openai"
  | "google"
  | "anthropic"
  | "xai"
  | "bfl"
  | "recraft"
  | "klingai"
  | "bytedance"
  | "deepseek"
  | "perplexity";

export type ThinkingEffortConfig = {
  type: "effort";
  values: readonly string[];
  default: string;
};

export type ThinkingBudgetPreset = {
  value: number;
  label: string;
};

export type ThinkingBudgetConfig = {
  type: "budget";
  presets: readonly ThinkingBudgetPreset[];
  default: number;
};

export type ThinkingConfig = ThinkingEffortConfig | ThinkingBudgetConfig;

export type ChatModel = {
  id: string;
  name: string;
  description: string;
  provider?: ModelProvider;
  capabilities?: ChatModelCapabilities;
  showInUI?: boolean;
  thinkingConfig?: ThinkingConfig;
  providerOptions?: SharedV2ProviderOptions;
  imageGenConfig?: ImageGenConfig;
  videoGenConfig?: VideoGenConfig;
};

export type ThinkingSettingEffort = {
  type: "effort";
  value: string;
};

export type ThinkingSettingBudget = {
  type: "budget";
  value: number;
};

export type ThinkingSetting = ThinkingSettingEffort | ThinkingSettingBudget;

export const FALLBACK_THINKING_EFFORT = "auto" as const;
export const THINKING_COOKIE_PREFIX = "thinking-v2" as const;

// Image generation setting types
export type ImageGenOption = { value: string; labelKey: string };
export type ImageGenQualityConfig = {
  options: readonly ImageGenOption[];
  default: string;
};
export type ImageGenAspectRatioConfig = {
  options: readonly ImageGenOption[];
  default: string;
};
export type ImageGenStyleConfig = {
  options: readonly ImageGenOption[];
  default: string;
};
export type ImageGenConfig = {
  quality?: ImageGenQualityConfig;
  aspectRatio?: ImageGenAspectRatioConfig;
  style?: ImageGenStyleConfig;
};
export type ImageGenSetting = {
  quality?: string;
  aspectRatio?: string;
  style?: string;
};

/** OpenAI image sizes are concrete pixel dims — map them to aspect tokens. */
export const IMAGE_SIZE_TO_ASPECT: Record<string, string> = {
  "1024x1024": "1:1",
  "1536x1024": "3:2",
  "1024x1536": "2:3",
};

/**
 * Normalize an aspect setting value to a "W:H" token for display and preview
 * sizing. "auto" (model decides) has no fixed shape and returns undefined.
 */
export const normalizeAspectRatio = (
  value: string | undefined
): string | undefined => {
  if (!value || value === "auto") {
    return;
  }
  return IMAGE_SIZE_TO_ASPECT[value] ?? value;
};

export const IMAGE_QUALITY_COOKIE_PREFIX = "image-quality" as const;
export const IMAGE_ASPECT_COOKIE_PREFIX = "image-aspect" as const;
export const IMAGE_STYLE_COOKIE_PREFIX = "image-style" as const;

// Video generation config — how a model accepts an image attachment:
// "required" (image-to-video), "optional" (used when present), or
// "unsupported" (text-to-video only; attachments must stay disabled).
export type VideoImageInput = "optional" | "required" | "unsupported";

/** One user-facing option group (same shape as image sections). */
export type VideoGenOptionSection = {
  options: readonly ImageGenOption[];
  default: string;
};

export type VideoGenConfig = {
  gatewayModelId: string;
  /** Fallback clip length when the model has no duration section/setting. */
  durationSeconds: number;
  imageInput: VideoImageInput;
  aspectRatio?: VideoGenOptionSection;
  /** Clip length choices; values are seconds as strings ("5", "10"). */
  duration?: VideoGenOptionSection;
  /** Output resolution tokens ("480p" | "720p" | "1080p"). */
  resolution?: VideoGenOptionSection;
  /** Kling render mode ("std" | "pro") — its quality knob. */
  mode?: VideoGenOptionSection;
};

/** Per-request user choice, validated against the model's VideoGenConfig. */
export type VideoGenSetting = {
  aspectRatio?: string;
  duration?: string;
  resolution?: string;
  mode?: string;
};

export const VIDEO_ASPECT_COOKIE_PREFIX = "video-aspect" as const;
export const VIDEO_DURATION_COOKIE_PREFIX = "video-duration" as const;
export const VIDEO_RESOLUTION_COOKIE_PREFIX = "video-resolution" as const;
export const VIDEO_MODE_COOKIE_PREFIX = "video-mode" as const;

const GOOGLE_IMAGE_GEN_CONFIG: ImageGenConfig = {
  quality: {
    options: [
      { value: "1K", labelKey: "standard" },
      { value: "2K", labelKey: "hd" },
      { value: "4K", labelKey: "ultra" },
    ],
    default: "2K",
  },
  aspectRatio: {
    options: [
      { value: "1:1", labelKey: "square" },
      { value: "16:9", labelKey: "landscape169" },
      { value: "9:16", labelKey: "portrait916" },
      { value: "3:2", labelKey: "wide32" },
      { value: "2:3", labelKey: "tall23" },
      { value: "4:3", labelKey: "standard43" },
      { value: "3:4", labelKey: "standard34" },
      { value: "5:4", labelKey: "photo54" },
      { value: "4:5", labelKey: "photo45" },
      { value: "21:9", labelKey: "ultrawide" },
    ],
    default: "1:1",
  },
};

// Nano Banana Lite only accepts 1K output — 2K/4K return a 400 from Google
// ("Image size 2K is not supported for this model").
const GOOGLE_LITE_IMAGE_GEN_CONFIG: ImageGenConfig = {
  quality: {
    options: [{ value: "1K", labelKey: "standard" }],
    default: "1K",
  },
  aspectRatio: GOOGLE_IMAGE_GEN_CONFIG.aspectRatio,
};

const OPENAI_IMAGE_GEN_CONFIG: ImageGenConfig = {
  quality: {
    options: [
      { value: "auto", labelKey: "auto" },
      { value: "low", labelKey: "low" },
      { value: "medium", labelKey: "medium" },
      { value: "high", labelKey: "high" },
    ],
    default: "auto",
  },
  aspectRatio: {
    options: [
      { value: "auto", labelKey: "auto" },
      { value: "1024x1024", labelKey: "square" },
      { value: "1536x1024", labelKey: "landscape" },
      { value: "1024x1536", labelKey: "portrait" },
    ],
    default: "1024x1024",
  },
};

// Grok Imagine accepts aspect_ratio (xAI docs also list exotic 2:1/20:9
// variants, kept out of the grid) with a 16:9 provider default.
const XAI_IMAGE_GEN_CONFIG: ImageGenConfig = {
  aspectRatio: {
    options: [
      { value: "16:9", labelKey: "landscape169" },
      { value: "9:16", labelKey: "portrait916" },
      { value: "1:1", labelKey: "square" },
      { value: "4:3", labelKey: "standard43" },
      { value: "3:4", labelKey: "standard34" },
      { value: "3:2", labelKey: "wide32" },
      { value: "2:3", labelKey: "tall23" },
    ],
    default: "16:9",
  },
};

// Flux Kontext accepts any ratio between 21:9 and 9:21 (BFL API spec;
// 16:9 verified through the gateway 2026-07). Flux 2 Max has NO settings:
// its API takes only width/height, and both aspectRatio and
// providerOptions.bfl dims are silently ignored by the gateway (verified) —
// so it gets no imageGenConfig rather than placebo controls.
const FLUX_KONTEXT_IMAGE_GEN_CONFIG: ImageGenConfig = {
  aspectRatio: {
    options: [
      { value: "1:1", labelKey: "square" },
      { value: "16:9", labelKey: "landscape169" },
      { value: "9:16", labelKey: "portrait916" },
      { value: "3:2", labelKey: "wide32" },
      { value: "2:3", labelKey: "tall23" },
      { value: "4:3", labelKey: "standard43" },
      { value: "3:4", labelKey: "standard34" },
      { value: "21:9", labelKey: "ultrawide" },
      { value: "9:21", labelKey: "ultratall" },
    ],
    default: "1:1",
  },
};

const RECRAFT_IMAGE_GEN_CONFIG: ImageGenConfig = {
  aspectRatio: {
    options: [
      { value: "1:1", labelKey: "square" },
      { value: "4:3", labelKey: "standard43" },
      { value: "3:4", labelKey: "standard34" },
      { value: "16:9", labelKey: "landscape169" },
      { value: "9:16", labelKey: "portrait916" },
      { value: "3:2", labelKey: "wide32" },
      { value: "2:3", labelKey: "tall23" },
    ],
    default: "1:1",
  },
};

const BYTEDANCE_IMAGE_GEN_CONFIG: ImageGenConfig = {
  aspectRatio: {
    options: [
      { value: "1:1", labelKey: "square" },
      { value: "4:3", labelKey: "standard43" },
      { value: "3:4", labelKey: "standard34" },
      { value: "16:9", labelKey: "landscape169" },
      { value: "9:16", labelKey: "portrait916" },
      { value: "3:2", labelKey: "wide32" },
      { value: "2:3", labelKey: "tall23" },
      { value: "21:9", labelKey: "ultrawide" },
    ],
    default: "1:1",
  },
};

// User-facing video sections. Values verified against the Vercel AI Gateway
// video docs + provider docs (2026-07); the gateway forwards params verbatim
// and enforces support server-side, so only documented values are offered.

const VIDEO_ASPECT_OPTIONS: Record<string, ImageGenOption> = {
  "16:9": { value: "16:9", labelKey: "landscape169" },
  "9:16": { value: "9:16", labelKey: "portrait916" },
  "1:1": { value: "1:1", labelKey: "square" },
  "4:3": { value: "4:3", labelKey: "standard43" },
  "3:4": { value: "3:4", labelKey: "standard34" },
  "3:2": { value: "3:2", labelKey: "wide32" },
  "2:3": { value: "2:3", labelKey: "tall23" },
  "21:9": { value: "21:9", labelKey: "ultrawide" },
};

const videoDurationOption = (seconds: number): ImageGenOption => ({
  value: String(seconds),
  labelKey: `duration${seconds}`,
});

// Veo 3.1: 16:9/9:16, 4/6/8s, 720p/1080p — 1080p requires an 8s clip
// (validateVideoGenSetting coerces the duration).
const VEO_VIDEO_GEN_SECTIONS = {
  aspectRatio: {
    options: [VIDEO_ASPECT_OPTIONS["16:9"], VIDEO_ASPECT_OPTIONS["9:16"]],
    default: "16:9",
  },
  duration: {
    options: [4, 6, 8].map(videoDurationOption),
    default: "8",
  },
  resolution: {
    options: [
      { value: "720p", labelKey: "res720" },
      { value: "1080p", labelKey: "res1080" },
    ],
    default: "720p",
  },
} satisfies Partial<VideoGenConfig>;

// Grok Imagine 1.5: 7 ratios, 1-15s (subset offered), 480p/720p via
// providerOptions.xai.resolution. For i2v the ratio must be omitted — the
// model follows the input image and an explicit ratio stretches it.
const GROK_VIDEO_GEN_SECTIONS = {
  aspectRatio: {
    options: [
      VIDEO_ASPECT_OPTIONS["16:9"],
      VIDEO_ASPECT_OPTIONS["9:16"],
      VIDEO_ASPECT_OPTIONS["1:1"],
      VIDEO_ASPECT_OPTIONS["4:3"],
      VIDEO_ASPECT_OPTIONS["3:4"],
      VIDEO_ASPECT_OPTIONS["3:2"],
      VIDEO_ASPECT_OPTIONS["2:3"],
    ],
    default: "16:9",
  },
  duration: {
    options: [4, 8, 12].map(videoDurationOption),
    default: "8",
  },
  resolution: {
    options: [
      { value: "480p", labelKey: "res480" },
      { value: "720p", labelKey: "res720" },
    ],
    default: "480p",
  },
} satisfies Partial<VideoGenConfig>;

// Kling: 16:9/9:16/1:1 (t2v only — i2v follows the input image), 5s/10s,
// std/pro mode via providerOptions.klingai.mode.
const KLING_VIDEO_GEN_SECTIONS = {
  aspectRatio: {
    options: [
      VIDEO_ASPECT_OPTIONS["16:9"],
      VIDEO_ASPECT_OPTIONS["9:16"],
      VIDEO_ASPECT_OPTIONS["1:1"],
    ],
    default: "16:9",
  },
  duration: {
    options: [5, 10].map(videoDurationOption),
    default: "5",
  },
  mode: {
    options: [
      { value: "std", labelKey: "modeStd" },
      { value: "pro", labelKey: "modePro" },
    ],
    default: "std",
  },
} satisfies Partial<VideoGenConfig>;

const KLING_I2V_VIDEO_GEN_SECTIONS = {
  duration: KLING_VIDEO_GEN_SECTIONS.duration,
  mode: KLING_VIDEO_GEN_SECTIONS.mode,
} satisfies Partial<VideoGenConfig>;

// Seedance 2.0: 6 ratios, 5s/10s. Resolution stays on the provider default
// (720p) — the gateway documents pixel-dim values that clash with portrait
// ratios, so it is not exposed until verified.
const SEEDANCE_VIDEO_GEN_SECTIONS = {
  aspectRatio: {
    options: [
      VIDEO_ASPECT_OPTIONS["16:9"],
      VIDEO_ASPECT_OPTIONS["9:16"],
      VIDEO_ASPECT_OPTIONS["1:1"],
      VIDEO_ASPECT_OPTIONS["4:3"],
      VIDEO_ASPECT_OPTIONS["3:4"],
      VIDEO_ASPECT_OPTIONS["21:9"],
    ],
    default: "16:9",
  },
  duration: {
    options: [5, 10].map(videoDurationOption),
    default: "5",
  },
} satisfies Partial<VideoGenConfig>;

const GPT5_THINKING_CONFIG: ThinkingEffortConfig = {
  type: "effort",
  values: ["auto", "none", "medium", "high"] as const,
  default: "auto",
};

const GEMINI31_THINKING_CONFIG: ThinkingEffortConfig = {
  type: "effort",
  values: ["auto", "low", "high"] as const,
  default: "auto",
};

const OPUS_THINKING_CONFIG: ThinkingEffortConfig = {
  type: "effort",
  values: ["auto", "low", "medium", "high"] as const,
  default: "auto",
};

export const chatModels: ChatModel[] = [
  {
    id: "grok-4.5",
    name: "grok45.name",
    description: "grok45.description",
    provider: "xai",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: true,
  },
  {
    id: "grok-4.3",
    name: "grok43.name",
    description: "grok43.description",
    provider: "xai",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: true,
  },
  {
    id: "gpt-5.6-sol",
    name: "gpt56Sol.name",
    description: "gpt56Sol.description",
    provider: "openai",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: true,
    thinkingConfig: GPT5_THINKING_CONFIG,
  },
  {
    id: "gpt-5.6-terra",
    name: "gpt56Terra.name",
    description: "gpt56Terra.description",
    provider: "openai",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: true,
    thinkingConfig: GPT5_THINKING_CONFIG,
  },
  {
    id: "gpt-5.6-luna",
    name: "gpt56Luna.name",
    description: "gpt56Luna.description",
    provider: "openai",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: true,
  },
  {
    id: "gpt-5.5",
    name: "gpt55.name",
    description: "gpt55.description",
    provider: "openai",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: true,
    thinkingConfig: GPT5_THINKING_CONFIG,
  },
  {
    id: "gpt-5.4-mini",
    name: "gpt54Mini.name",
    description: "gpt54Mini.description",
    provider: "openai",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: true,
  },
  {
    id: "gpt-5.4-nano",
    name: "gpt54Nano.name",
    description: "gpt54Nano.description",
    provider: "openai",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: true,
  },
  {
    id: "gpt-codex-5.3",
    name: "gptCodex53.name",
    description: "gptCodex53.description",
    provider: "openai",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: true,
    thinkingConfig: GPT5_THINKING_CONFIG,
  },
  {
    id: "gemini-3.1-pro",
    name: "gemini31Pro.name",
    description: "gemini31Pro.description",
    provider: "google",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: true,
    thinkingConfig: GEMINI31_THINKING_CONFIG,
  },
  {
    id: "gemini-3.6-flash",
    name: "gemini36Flash.name",
    description: "gemini36Flash.description",
    provider: "google",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: true,
    thinkingConfig: GEMINI31_THINKING_CONFIG,
  },
  {
    id: "gemini-3.5-flash",
    name: "gemini35Flash.name",
    description: "gemini35Flash.description",
    provider: "google",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: true,
    thinkingConfig: GEMINI31_THINKING_CONFIG,
  },
  {
    id: "gemini-3.5-flash-lite",
    name: "gemini35FlashLite.name",
    description: "gemini35FlashLite.description",
    provider: "google",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: true,
    thinkingConfig: GEMINI31_THINKING_CONFIG,
  },
  {
    id: "gemini-3-pro-image",
    name: "gemini3ProImage.name",
    description: "gemini3ProImage.description",
    provider: "google",
    capabilities: {
      reasoning: true,
      attachments: true,
      imageGeneration: true,
    },
    showInUI: true,
    providerOptions: {
      google: {
        // No mediaResolution here: Google rejects it on gemini-3-pro-image
        // with 400 "Request contains an invalid argument." (both vertex and
        // google gateway backends, probed 2026-07-25), which failed every
        // direct-path generation. Flash/Lite still accept it.
        imageConfig: {
          imageSize: "2K",
          aspectRatio: "16:9",
        },
      } satisfies GoogleGenerativeAIProviderOptions,
    },
    imageGenConfig: GOOGLE_IMAGE_GEN_CONFIG,
  },
  {
    id: "gemini-3.1-flash-image",
    name: "gemini31FlashImage.name",
    description: "gemini31FlashImage.description",
    provider: "google",
    capabilities: {
      reasoning: true,
      attachments: true,
      imageGeneration: true,
    },
    showInUI: true,
    providerOptions: {
      google: {
        mediaResolution: "MEDIA_RESOLUTION_HIGH",
        imageConfig: {
          imageSize: "2K",
          aspectRatio: "16:9",
        },
      } satisfies GoogleGenerativeAIProviderOptions,
    },
    imageGenConfig: GOOGLE_IMAGE_GEN_CONFIG,
  },
  {
    id: "gemini-3.1-flash-lite-image",
    name: "gemini31FlashLiteImage.name",
    description: "gemini31FlashLiteImage.description",
    provider: "google",
    capabilities: {
      reasoning: true,
      attachments: true,
      imageGeneration: true,
    },
    showInUI: true,
    providerOptions: {
      google: {
        mediaResolution: "MEDIA_RESOLUTION_HIGH",
        imageConfig: {
          imageSize: "1K",
          aspectRatio: "16:9",
        },
      } satisfies GoogleGenerativeAIProviderOptions,
    },
    imageGenConfig: GOOGLE_LITE_IMAGE_GEN_CONFIG,
  },
  {
    id: "grok-imagine-image",
    name: "grokImagineImage.name",
    description: "grokImagineImage.description",
    provider: "xai",
    capabilities: {
      attachments: true,
      imageGeneration: true,
    },
    showInUI: true,
    imageGenConfig: XAI_IMAGE_GEN_CONFIG,
  },
  {
    id: "gpt-image-2",
    name: "gptImage2.name",
    description: "gptImage2.description",
    provider: "openai",
    capabilities: {
      reasoning: true,
      attachments: true,
      imageGeneration: true,
    },
    showInUI: true,
    providerOptions: {
      openai: {
        imageSize: "1024x1024",
        imageQuality: "hd",
      },
    },
    imageGenConfig: OPENAI_IMAGE_GEN_CONFIG,
  },
  {
    id: "opus-5",
    name: "opus5.name",
    description: "opus5.description",
    provider: "anthropic",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: true,
    thinkingConfig: OPUS_THINKING_CONFIG,
  },
  {
    id: "opus-4.8",
    name: "opus48.name",
    description: "opus48.description",
    provider: "anthropic",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: true,
    thinkingConfig: OPUS_THINKING_CONFIG,
  },
  {
    id: "sonnet-5",
    name: "sonnet5.name",
    description: "sonnet5.description",
    provider: "anthropic",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: true,
    thinkingConfig: OPUS_THINKING_CONFIG,
  },
  {
    id: "sonnet-4.6",
    name: "sonnet46.name",
    description: "sonnet46.description",
    provider: "anthropic",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: true,
    thinkingConfig: OPUS_THINKING_CONFIG,
  },
  {
    id: "haiku-4.5",
    name: "haiku45.name",
    description: "haiku45.description",
    provider: "anthropic",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: true,
    thinkingConfig: OPUS_THINKING_CONFIG,
  },
  {
    id: "deepseek-v4-pro",
    name: "deepseekV4Pro.name",
    description: "deepseekV4Pro.description",
    provider: "deepseek",
    capabilities: {
      reasoning: true,
    },
    showInUI: true,
  },
  {
    id: "deepseek-v4-flash",
    name: "deepseekV4Flash.name",
    description: "deepseekV4Flash.description",
    provider: "deepseek",
    capabilities: {
      reasoning: true,
    },
    showInUI: true,
  },
  {
    id: "sonar",
    name: "sonar.name",
    description: "sonar.description",
    provider: "perplexity",
    capabilities: {
      attachments: true,
      toolCalling: false,
    },
    showInUI: true,
  },
  {
    id: "sonar-pro",
    name: "sonarPro.name",
    description: "sonarPro.description",
    provider: "perplexity",
    capabilities: {
      attachments: true,
      toolCalling: false,
    },
    showInUI: true,
  },
  {
    id: "sonar-reasoning-pro",
    name: "sonarReasoningPro.name",
    description: "sonarReasoningPro.description",
    provider: "perplexity",
    capabilities: {
      reasoning: true,
      toolCalling: false,
    },
    showInUI: true,
  },
  {
    id: "veo-3.1",
    name: "veo31.name",
    description: "veo31.description",
    provider: "google",
    capabilities: {
      videoGeneration: true,
      attachments: true,
    },
    showInUI: true,
    videoGenConfig: {
      gatewayModelId: "google/veo-3.1-generate-001",
      durationSeconds: 8,
      imageInput: "optional",
      ...VEO_VIDEO_GEN_SECTIONS,
    },
  },
  {
    id: "veo-3.1-fast",
    name: "veo31Fast.name",
    description: "veo31Fast.description",
    provider: "google",
    capabilities: {
      videoGeneration: true,
      attachments: true,
    },
    showInUI: true,
    videoGenConfig: {
      gatewayModelId: "google/veo-3.1-fast-generate-001",
      durationSeconds: 8,
      imageInput: "optional",
      ...VEO_VIDEO_GEN_SECTIONS,
    },
  },
  {
    id: "grok-imagine-video",
    name: "grokImagineVideo.name",
    description: "grokImagineVideo.description",
    provider: "xai",
    capabilities: {
      videoGeneration: true,
      attachments: true,
    },
    showInUI: true,
    videoGenConfig: {
      gatewayModelId: "xai/grok-imagine-video-1.5-preview",
      durationSeconds: 8,
      imageInput: "optional",
      ...GROK_VIDEO_GEN_SECTIONS,
    },
  },
  {
    id: "kling-v3.0-t2v",
    name: "klingV30T2v.name",
    description: "klingV30T2v.description",
    provider: "klingai",
    capabilities: {
      videoGeneration: true,
    },
    showInUI: true,
    videoGenConfig: {
      gatewayModelId: "klingai/kling-v3.0-t2v",
      durationSeconds: 5,
      imageInput: "unsupported",
      ...KLING_VIDEO_GEN_SECTIONS,
    },
  },
  {
    id: "kling-v3.0-i2v",
    name: "klingV30I2v.name",
    description: "klingV30I2v.description",
    provider: "klingai",
    capabilities: {
      videoGeneration: true,
      attachments: true,
    },
    showInUI: true,
    videoGenConfig: {
      gatewayModelId: "klingai/kling-v3.0-i2v",
      durationSeconds: 5,
      imageInput: "required",
      ...KLING_I2V_VIDEO_GEN_SECTIONS,
    },
  },
  {
    id: "kling-v2.6-t2v",
    name: "klingV26T2v.name",
    description: "klingV26T2v.description",
    provider: "klingai",
    capabilities: {
      videoGeneration: true,
    },
    showInUI: true,
    videoGenConfig: {
      gatewayModelId: "klingai/kling-v2.6-t2v",
      durationSeconds: 5,
      imageInput: "unsupported",
      ...KLING_VIDEO_GEN_SECTIONS,
    },
  },
  {
    id: "kling-v2.5-turbo-t2v",
    name: "klingV25TurboT2v.name",
    description: "klingV25TurboT2v.description",
    provider: "klingai",
    capabilities: {
      videoGeneration: true,
    },
    showInUI: true,
    videoGenConfig: {
      gatewayModelId: "klingai/kling-v2.5-turbo-t2v",
      durationSeconds: 5,
      imageInput: "unsupported",
      ...KLING_VIDEO_GEN_SECTIONS,
    },
  },
  {
    id: "seedance-2.0",
    name: "seedance20.name",
    description: "seedance20.description",
    provider: "bytedance",
    capabilities: {
      videoGeneration: true,
      attachments: true,
    },
    showInUI: true,
    videoGenConfig: {
      gatewayModelId: "bytedance/seedance-2.0",
      durationSeconds: 5,
      imageInput: "optional",
      ...SEEDANCE_VIDEO_GEN_SECTIONS,
    },
  },
  {
    id: "seedance-2.0-fast",
    name: "seedance20Fast.name",
    description: "seedance20Fast.description",
    provider: "bytedance",
    capabilities: {
      videoGeneration: true,
      attachments: true,
    },
    showInUI: true,
    videoGenConfig: {
      gatewayModelId: "bytedance/seedance-2.0-fast",
      durationSeconds: 5,
      imageInput: "optional",
      ...SEEDANCE_VIDEO_GEN_SECTIONS,
    },
  },
  {
    id: "flux-2-max",
    name: "flux2Max.name",
    description: "flux2Max.description",
    provider: "bfl",
    capabilities: {
      attachments: true,
      imageGeneration: true,
    },
    showInUI: true,
  },
  {
    id: "flux-kontext-max",
    name: "fluxKontextMax.name",
    description: "fluxKontextMax.description",
    provider: "bfl",
    capabilities: {
      attachments: true,
      imageGeneration: true,
    },
    showInUI: true,
    imageGenConfig: FLUX_KONTEXT_IMAGE_GEN_CONFIG,
  },
  {
    id: "recraft-v4.1-pro",
    name: "recraftV41Pro.name",
    description: "recraftV41Pro.description",
    provider: "recraft",
    capabilities: {
      attachments: true,
      imageGeneration: true,
    },
    showInUI: true,
    imageGenConfig: RECRAFT_IMAGE_GEN_CONFIG,
  },
  {
    id: "seedream-5.0-lite",
    name: "seedream50Lite.name",
    description: "seedream50Lite.description",
    provider: "bytedance",
    capabilities: {
      attachments: true,
      imageGeneration: true,
    },
    showInUI: true,
    imageGenConfig: BYTEDANCE_IMAGE_GEN_CONFIG,
  },
  {
    id: "seedream-4.5",
    name: "seedream45.name",
    description: "seedream45.description",
    provider: "bytedance",
    capabilities: {
      attachments: true,
      imageGeneration: true,
    },
    showInUI: true,
    imageGenConfig: BYTEDANCE_IMAGE_GEN_CONFIG,
  },
];

export const chatModelIds = chatModels.map((model) => model.id);

export const uiVisibleChatModels = chatModels.filter(
  (model) => model.showInUI !== false
);

const reasoningModelIds = new Set(
  chatModels
    .filter((model) => model.capabilities?.reasoning)
    .map((model) => model.id)
);

export const isReasoningModelId = (modelId: string) =>
  reasoningModelIds.has(modelId);

/**
 * True when this model is wrapped with `extractReasoningMiddleware({tagName:"think"})`
 * in `lib/ai/providers.ts` and therefore needs the system prompt to instruct
 * `<think></think>` tag emission. Only OpenAI gpt-5.x is wrapped today.
 *
 * Exception: sonar-reasoning-pro is also wrapped in providers.ts, but
 * Perplexity emits `<think>` tags on its own — the middleware strips them
 * without any prompt instruction, so it intentionally stays false here and
 * receives `nativeReasoningPrompt`.
 *
 * Native-reasoning models (Anthropic extended thinking, grok-4.x, and Gemini 3
 * with `includeThoughts`) must NOT receive that instruction — they'd echo literal
 * `<think>` tags into the visible body since no middleware strips them, and for
 * Gemini the tag path also corrupts thought signatures across multi-turn tool
 * calls (GIPITI-82).
 *
 * Keep this in sync if the wrapping rule in providers.ts ever changes.
 */
export const usesReasoningTagMiddleware = (modelId: string): boolean => {
  const model = getModelById(modelId);
  if (!model?.capabilities?.reasoning) {
    return false;
  }
  return model.provider === "openai";
};

const imageGenerationModelIds = new Set(
  chatModels
    .filter((model) => model.capabilities?.imageGeneration)
    .map((model) => model.id)
);

export const isImageGenerationModel = (modelId: string) =>
  imageGenerationModelIds.has(modelId);

/**
 * Dedicated image models only have `imageGeneration` capability
 * (no reasoning, no attachments). They use `generateImage()` + `gateway.imageModel()`
 * instead of `streamText()` + `gateway.languageModel()`.
 */
export const isDedicatedImageModel = (modelId: string): boolean => {
  const model = chatModels.find((m) => m.id === modelId);
  if (!model?.capabilities?.imageGeneration) {
    return false;
  }
  // Dedicated = image-only model, not a multimodal LLM. Multimodal image models
  // (Gemini, gpt-image-2) are distinguished by `reasoning`; keyed on that so
  // enabling `attachments` on a dedicated model doesn't reclassify it.
  return !model.capabilities.reasoning;
};

const videoGenerationModelIds = new Set(
  chatModels
    .filter((model) => model.capabilities?.videoGeneration)
    .map((model) => model.id)
);

export const isVideoGenerationModel = (modelId: string) =>
  videoGenerationModelIds.has(modelId);

type DedicatedImageModelId =
  | "grok-imagine-image"
  | "flux-2-max"
  | "flux-kontext-max"
  | "recraft-v4.1-pro"
  | "seedream-5.0-lite"
  | "seedream-4.5";

const DEDICATED_IMAGE_GATEWAY_MAP: Record<DedicatedImageModelId, string> = {
  "grok-imagine-image": "xai/grok-imagine-image",
  "flux-2-max": "bfl/flux-2-max",
  "flux-kontext-max": "bfl/flux-kontext-max",
  "recraft-v4.1-pro": "recraft/recraft-v4.1-pro",
  "seedream-5.0-lite": "bytedance/seedream-5.0-lite",
  "seedream-4.5": "bytedance/seedream-4.5",
};

export const getDedicatedImageGatewayModelId = (modelId: string): string => {
  const gatewayId =
    DEDICATED_IMAGE_GATEWAY_MAP[modelId as DedicatedImageModelId];
  if (!gatewayId) {
    throw new Error(`Unknown dedicated image model: ${modelId}`);
  }
  return gatewayId;
};

/** Gateway model id backing the OpenAI gpt-image generation/edit flow. */
export const OPENAI_IMAGE_GATEWAY_MODEL_ID = "openai/gpt-image-2";

/**
 * OpenAI's gpt-image model. Unlike dedicated image models it also advertises
 * `reasoning` + `attachments` (to enable the image-edit upload flow in the UI),
 * so it needs its own predicate rather than being matched by
 * `isDedicatedImageModel`. It is generated via `generateImage()` +
 * `gateway.imageModel()`, supporting both text-to-image and edit modes.
 */
export const isOpenAIImageModel = (modelId: string): boolean =>
  modelId === "gpt-image-2";

export const getVideoGenConfig = (modelId: string): VideoGenConfig => {
  const config = getModelById(modelId)?.videoGenConfig;
  if (!config) {
    throw new Error(`Missing video config for model: ${modelId}`);
  }
  return config;
};

export const supportsAttachments = (modelId: string) => {
  const model = chatModels.find((m) => m.id === modelId);
  return model?.capabilities?.attachments ?? false;
};

export const supportsToolCalling = (modelId: string): boolean =>
  getModelById(modelId)?.capabilities?.toolCalling !== false;

export const isVisibleInUI = (modelId: string): boolean => {
  const model = chatModels.find((m) => m.id === modelId);
  return model?.showInUI !== false;
};

export const getModelById = (modelId: string): ChatModel | undefined => {
  return chatModels.find((m) => m.id === modelId);
};

export const supportsThinkingConfig = (modelId: string): boolean => {
  const model = getModelById(modelId);
  return model?.thinkingConfig !== undefined;
};

export const getDefaultThinkingSetting = (
  modelId: string
): ThinkingSetting | undefined => {
  const model = getModelById(modelId);
  if (!model?.thinkingConfig) {
    return;
  }

  if (model.thinkingConfig.type === "effort") {
    return { type: "effort", value: model.thinkingConfig.default };
  }
  return { type: "budget", value: model.thinkingConfig.default };
};

export const REASONING_SUMMARY = ["auto", "concise", "detailed"] as const;
export type ReasoningSummary = (typeof REASONING_SUMMARY)[number];
export const DEFAULT_REASONING_SUMMARY: ReasoningSummary = "auto";

export const openaiModelIds = [
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
  "gpt-5.5",
  "gpt-5.4-mini",
  "gpt-5.4-nano",
  "gpt-codex-5.3",
] as const;
export type OpenAIModelId = (typeof openaiModelIds)[number];

export const isOpenAIModel = (modelId: string) => {
  return openaiModelIds.includes(modelId as OpenAIModelId);
};

type OpenAIProviderOptionsInput = {
  reasoningEffort: string;
  reasoningSummary?: ReasoningSummary;
};

export const getOpenAIProviderOptions = (
  options: OpenAIProviderOptionsInput
): SharedV2ProviderOptions => {
  return {
    openai: {
      reasoningEffort: options.reasoningEffort,
      reasoningSummary: options.reasoningSummary ?? "auto",
    },
  };
};

export const googleModelIds = [
  "gemini-3.1-pro",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
] as const;
export type GoogleModelId = (typeof googleModelIds)[number];

export const isGoogleModel = (modelId: string) => {
  return googleModelIds.includes(modelId as GoogleModelId);
};

type GoogleProviderOptionsInput = {
  reasoningEffort: string;
};

export const getGoogleProviderOptions = (
  options: GoogleProviderOptionsInput
): SharedV2ProviderOptions => {
  return {
    google: {
      thinkingConfig: {
        thinkingLevel: options.reasoningEffort,
        includeThoughts: true,
      },
    },
  };
};

export const anthropicModelIds = [
  "opus-5",
  "opus-4.8",
  "sonnet-5",
  "sonnet-4.6",
  "haiku-4.5",
] as const;
export type AnthropicModelId = (typeof anthropicModelIds)[number];

export const isAnthropicModel = (modelId: string) => {
  return anthropicModelIds.includes(modelId as AnthropicModelId);
};

type AnthropicProviderOptionsInput = {
  effort: string;
};

export const getAnthropicProviderOptions = (
  options: AnthropicProviderOptionsInput
): SharedV2ProviderOptions => {
  return {
    anthropic: {
      effort: options.effort,
    },
  };
};

export const isAutoReasoning = (thinkingSetting?: ThinkingSetting): boolean => {
  return thinkingSetting?.type === "effort" && thinkingSetting.value === "auto";
};

export const getProviderOptions = (
  modelId: string,
  thinkingSetting?: ThinkingSetting
): SharedV2ProviderOptions => {
  const base: SharedV2ProviderOptions = {
    gateway: { caching: "auto" },
  };

  const model = getModelById(modelId);
  if (!model?.provider || !model.thinkingConfig || !thinkingSetting) {
    return base;
  }

  // Auto mode: let the model decide reasoning depth by omitting effort params
  if (isAutoReasoning(thinkingSetting)) {
    if (model.provider === "google") {
      return {
        ...base,
        google: {
          thinkingConfig: { includeThoughts: true },
        },
      };
    }
    return base;
  }

  switch (model.provider) {
    case "openai": {
      if (thinkingSetting.type !== "effort") {
        return base;
      }
      return {
        ...base,
        ...getOpenAIProviderOptions({
          reasoningEffort: thinkingSetting.value,
          reasoningSummary: "auto",
        }),
      };
    }

    case "google": {
      if (thinkingSetting.type !== "effort") {
        return base;
      }

      return {
        ...base,
        ...getGoogleProviderOptions({
          reasoningEffort: thinkingSetting.value,
        }),
      };
    }

    case "anthropic": {
      if (thinkingSetting.type !== "effort") {
        return base;
      }

      return {
        ...base,
        ...getAnthropicProviderOptions({
          effort: thinkingSetting.value,
        }),
      };
    }

    default:
      return base;
  }
};

export const parseThinkingSettingFromCookie = (
  modelId: string,
  cookieValue: string | undefined
): ThinkingSetting | undefined => {
  const model = getModelById(modelId);
  if (!model?.thinkingConfig || !cookieValue) {
    return getDefaultThinkingSetting(modelId);
  }

  if (model.thinkingConfig.type === "effort") {
    if (model.thinkingConfig.values.includes(cookieValue)) {
      return { type: "effort", value: cookieValue };
    }
    return { type: "effort", value: FALLBACK_THINKING_EFFORT };
  }

  const numValue = Number.parseInt(cookieValue, 10);
  if (
    !Number.isNaN(numValue) &&
    model.thinkingConfig.presets.some((p) => p.value === numValue)
  ) {
    return { type: "budget", value: numValue };
  }
  return { type: "budget", value: model.thinkingConfig.default };
};

export const serializeThinkingSetting = (setting: ThinkingSetting): string => {
  return String(setting.value);
};

/**
 * Validates a thinking setting against the model's thinking config.
 * Returns a sanitized setting, falling back to "auto" for effort models
 * or the config default for budget models when the input is invalid.
 */
export const validateThinkingSetting = (
  modelId: string,
  thinkingSetting: ThinkingSetting | undefined
): ThinkingSetting | undefined => {
  const model = getModelById(modelId);
  if (!model?.thinkingConfig) {
    return;
  }

  const config = model.thinkingConfig;

  if (!thinkingSetting) {
    if (config.type === "effort") {
      return { type: "effort", value: FALLBACK_THINKING_EFFORT };
    }
    return { type: "budget", value: config.default };
  }

  if (config.type === "effort") {
    if (thinkingSetting.type !== "effort") {
      return { type: "effort", value: FALLBACK_THINKING_EFFORT };
    }
    if (!config.values.includes(thinkingSetting.value)) {
      return { type: "effort", value: FALLBACK_THINKING_EFFORT };
    }
    return thinkingSetting;
  }

  if (thinkingSetting.type !== "budget") {
    return { type: "budget", value: config.default };
  }
  if (!config.presets.some((p) => p.value === thinkingSetting.value)) {
    return { type: "budget", value: config.default };
  }
  return thinkingSetting;
};

// Image generation setting helpers

export const supportsImageGenConfig = (modelId: string): boolean => {
  const model = getModelById(modelId);
  return model?.imageGenConfig !== undefined;
};

export const getDefaultImageGenSetting = (
  modelId: string
): ImageGenSetting | undefined => {
  const model = getModelById(modelId);
  if (!model?.imageGenConfig) {
    return;
  }

  return {
    quality: model.imageGenConfig.quality?.default,
    aspectRatio: model.imageGenConfig.aspectRatio?.default,
    style: model.imageGenConfig.style?.default,
  };
};

export const parseImageGenSettingFromCookie = (
  modelId: string,
  qualityCookie: string | undefined,
  aspectCookie: string | undefined,
  styleCookie?: string | undefined
): ImageGenSetting | undefined => {
  const model = getModelById(modelId);
  if (!model?.imageGenConfig) {
    return;
  }

  const defaults = getDefaultImageGenSetting(modelId);
  const quality =
    qualityCookie &&
    model.imageGenConfig.quality?.options.some((o) => o.value === qualityCookie)
      ? qualityCookie
      : defaults?.quality;
  const aspectRatio =
    aspectCookie &&
    model.imageGenConfig.aspectRatio?.options.some(
      (o) => o.value === aspectCookie
    )
      ? aspectCookie
      : defaults?.aspectRatio;
  const style =
    styleCookie &&
    model.imageGenConfig.style?.options.some((o) => o.value === styleCookie)
      ? styleCookie
      : defaults?.style;

  return { quality, aspectRatio, style };
};

export const validateImageGenSetting = (
  modelId: string,
  setting: ImageGenSetting | undefined
): ImageGenSetting | undefined => {
  const model = getModelById(modelId);
  if (!model?.imageGenConfig) {
    return;
  }

  const defaults = getDefaultImageGenSetting(modelId);
  if (!setting) {
    return defaults;
  }

  const quality =
    setting.quality &&
    model.imageGenConfig.quality?.options.some(
      (o) => o.value === setting.quality
    )
      ? setting.quality
      : defaults?.quality;
  const aspectRatio =
    setting.aspectRatio &&
    model.imageGenConfig.aspectRatio?.options.some(
      (o) => o.value === setting.aspectRatio
    )
      ? setting.aspectRatio
      : defaults?.aspectRatio;
  const style =
    setting.style &&
    model.imageGenConfig.style?.options.some((o) => o.value === setting.style)
      ? setting.style
      : defaults?.style;

  return { quality, aspectRatio, style };
};

// Video generation setting helpers

/** Keep `value` when the section offers it; otherwise fall back. */
const pickVideoOption = (
  section: VideoGenOptionSection | undefined,
  value: string | undefined,
  fallback: string | undefined
): string | undefined => {
  if (value && section?.options.some((option) => option.value === value)) {
    return value;
  }
  return fallback;
};

/** True when the model exposes at least one user-facing video section. */
export const supportsVideoGenConfig = (modelId: string): boolean => {
  const config = getModelById(modelId)?.videoGenConfig;
  return Boolean(
    config &&
      (config.aspectRatio ||
        config.duration ||
        config.resolution ||
        config.mode)
  );
};

export const getDefaultVideoGenSetting = (
  modelId: string
): VideoGenSetting | undefined => {
  const config = getModelById(modelId)?.videoGenConfig;
  if (!supportsVideoGenConfig(modelId) || !config) {
    return;
  }

  return {
    aspectRatio: config.aspectRatio?.default,
    duration: config.duration?.default,
    resolution: config.resolution?.default,
    mode: config.mode?.default,
  };
};

export const parseVideoGenSettingFromCookie = (
  modelId: string,
  cookieValues: VideoGenSetting
): VideoGenSetting | undefined => {
  return validateVideoGenSetting(modelId, cookieValues);
};

export const validateVideoGenSetting = (
  modelId: string,
  setting: VideoGenSetting | undefined
): VideoGenSetting | undefined => {
  const config = getModelById(modelId)?.videoGenConfig;
  if (!supportsVideoGenConfig(modelId) || !config) {
    return;
  }

  const defaults = getDefaultVideoGenSetting(modelId);
  const validated: VideoGenSetting = {
    aspectRatio: pickVideoOption(
      config.aspectRatio,
      setting?.aspectRatio,
      defaults?.aspectRatio
    ),
    duration: pickVideoOption(
      config.duration,
      setting?.duration,
      defaults?.duration
    ),
    resolution: pickVideoOption(
      config.resolution,
      setting?.resolution,
      defaults?.resolution
    ),
    mode: pickVideoOption(config.mode, setting?.mode, defaults?.mode),
  };

  // Veo constraint: 1080p output requires an 8-second clip.
  if (
    validated.resolution === "1080p" &&
    config.gatewayModelId.startsWith("google/veo") &&
    config.duration
  ) {
    validated.duration = "8";
  }

  return validated;
};
