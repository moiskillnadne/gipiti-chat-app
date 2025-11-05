export const DEFAULT_CHAT_MODEL: string = "chat-model";

export type ChatModelCapabilities = {
  reasoning?: boolean;
  attachments?: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  description: string;
  capabilities?: ChatModelCapabilities;
};

export const chatModels: ChatModel[] = [
  {
    id: "chat-model",
    name: "grokVision.name",
    description: "grokVision.description",
    capabilities: {
      attachments: true,
    },
  },
  {
    id: "chat-model-reasoning",
    name: "grokReasoning.name",
    description: "grokReasoning.description",
    capabilities: {
      reasoning: true,
      attachments: false,
    },
  },
  {
    id: "gpt-5",
    name: "gpt5.name",
    description: "gpt5.description",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
  },
  {
    id: "gpt-5-pro",
    name: "gpt5Pro.name",
    description: "gpt5Pro.description",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
  },
  {
    id: "gpt-5-mini",
    name: "gpt5Mini.name",
    description: "gpt5Mini.description",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
  },
  {
    id: "gemini-2.5-pro",
    name: "gemini25Pro.name",
    description: "gemini25Pro.description",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
  },
  {
    id: "opus-4.1",
    name: "opus41.name",
    description: "opus41.description",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
  },
];

export const chatModelIds = chatModels.map((model) => model.id);

const reasoningModelIds = new Set(
  chatModels
    .filter((model) => model.capabilities?.reasoning)
    .map((model) => model.id)
);

export const isReasoningModelId = (modelId: string) =>
  reasoningModelIds.has(modelId);

export const supportsAttachments = (modelId: string) =>
  !reasoningModelIds.has(modelId);
