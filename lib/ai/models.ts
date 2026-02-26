import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import type { SharedV2ProviderOptions } from "@ai-sdk/provider";

export const DEFAULT_CHAT_MODEL: string = "gpt-5.2";

export type ChatModelCapabilities = {
  reasoning?: boolean;
  attachments?: boolean;
  imageGeneration?: boolean;
};

export type ModelProvider = "openai" | "google" | "anthropic" | "xai";

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

const GPT52_THINKING_CONFIG: ThinkingEffortConfig = {
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
    id: "chat-model",
    name: "grokVision.name",
    description: "grokVision.description",
    provider: "xai",
    capabilities: {
      attachments: true,
    },
    showInUI: false,
  },
  {
    id: "chat-model-reasoning",
    name: "grokReasoning.name",
    description: "grokReasoning.description",
    provider: "xai",
    capabilities: {
      reasoning: true,
      attachments: false,
    },
    showInUI: false,
  },
  {
    id: "grok-4.1-reasoning",
    name: "grok41Reasoning.name",
    description: "grok41Reasoning.description",
    provider: "xai",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: true,
  },
  {
    id: "grok-4.1-non-reasoning",
    name: "grok41Fast.name",
    description: "grok41Fast.description",
    provider: "xai",
    capabilities: {
      reasoning: false,
      attachments: true,
    },
    showInUI: true,
  },
  {
    id: "grok-code-fast-1",
    name: "grokCodeFast1.name",
    description: "grokCodeFast1.description",
    provider: "xai",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: true,
  },
  {
    id: "gpt-5",
    name: "gpt5.name",
    description: "gpt5.description",
    provider: "openai",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: false,
  },
  {
    id: "gpt-5.1-instant",
    name: "gpt51Instant.name",
    description: "gpt51Instant.description",
    provider: "openai",
    capabilities: {
      reasoning: false,
      attachments: true,
    },
    showInUI: false,
  },
  {
    id: "gpt-5.1-thinking",
    name: "gpt51Thinking.name",
    description: "gpt51Thinking.description",
    provider: "openai",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: false,
  },
  {
    id: "gpt-5.2",
    name: "gpt52.name",
    description: "gpt52.description",
    provider: "openai",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: true,
    thinkingConfig: GPT52_THINKING_CONFIG,
  },
  {
    id: "gpt-5.2-pro",
    name: "gpt52Pro.name",
    description: "gpt52Pro.description",
    provider: "openai",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: false,
  },
  {
    id: "gpt-5-mini",
    name: "gpt5Mini.name",
    description: "gpt5Mini.description",
    provider: "openai",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: false,
  },
  {
    id: "gpt-codex-5.2",
    name: "gptCodex52.name",
    description: "gptCodex52.description",
    provider: "openai",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: true,
    thinkingConfig: GPT52_THINKING_CONFIG,
  },
  {
    id: "gemini-2.5-pro",
    name: "gemini25Pro.name",
    description: "gemini25Pro.description",
    provider: "google",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: false,
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
        mediaResolution: "MEDIA_RESOLUTION_HIGH",
        imageConfig: {
          imageSize: "2K",
          aspectRatio: "16:9",
        },
      } satisfies GoogleGenerativeAIProviderOptions,
    },
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
  },
  {
    id: "gpt-image-1.5",
    name: "gptImage15.name",
    description: "gptImage15.description",
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
  },
  {
    id: "opus-4.1",
    name: "opus41.name",
    description: "opus41.description",
    provider: "anthropic",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: false,
  },
  {
    id: "opus-4.6",
    name: "opus46.name",
    description: "opus46.description",
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

const imageGenerationModelIds = new Set(
  chatModels
    .filter((model) => model.capabilities?.imageGeneration)
    .map((model) => model.id)
);

export const isImageGenerationModel = (modelId: string) =>
  imageGenerationModelIds.has(modelId);

export const supportsAttachments = (modelId: string) => {
  const model = chatModels.find((m) => m.id === modelId);
  return model?.capabilities?.attachments ?? false;
};

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
  "gpt-5.2",
  "gpt-5.2-pro",
  "gpt-5-mini",
  "gpt-codex-5.2",
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

export const googleModelIds = ["gemini-3.1-pro"] as const;
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
  "opus-4.1",
  "opus-4.6",
  "sonnet-4.6",
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
  const model = getModelById(modelId);
  if (!model?.provider || !model.thinkingConfig || !thinkingSetting) {
    return {};
  }

  // Auto mode: let the model decide reasoning depth by omitting effort params
  if (isAutoReasoning(thinkingSetting)) {
    if (model.provider === "google") {
      return {
        google: {
          thinkingConfig: { includeThoughts: true },
        },
      };
    }
    return {};
  }

  switch (model.provider) {
    case "openai": {
      if (thinkingSetting.type !== "effort") {
        return {};
      }
      return getOpenAIProviderOptions({
        reasoningEffort: thinkingSetting.value,
        reasoningSummary: "auto",
      });
    }
    case "google": {
      if (thinkingSetting.type !== "effort") {
        return {};
      }
      return getGoogleProviderOptions({
        reasoningEffort: thinkingSetting.value,
      });
    }
    case "anthropic": {
      if (thinkingSetting.type !== "effort") {
        return {};
      }
      return getAnthropicProviderOptions({
        effort: thinkingSetting.value,
      });
    }
    default:
      return {};
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
