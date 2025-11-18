export const DEFAULT_CHAT_MODEL: string = "gpt-5.1-instant";

export type ChatModelCapabilities = {
  reasoning?: boolean;
  attachments?: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  description: string;
  capabilities?: ChatModelCapabilities;
  showInUI?: boolean;
};

export const chatModels: ChatModel[] = [
  {
    id: "chat-model",
    name: "grokVision.name",
    description: "grokVision.description",
    capabilities: {
      attachments: true,
    },
    showInUI: false,
  },
  {
    id: "chat-model-reasoning",
    name: "grokReasoning.name",
    description: "grokReasoning.description",
    capabilities: {
      reasoning: true,
      attachments: false,
    },
    showInUI: false,
  },
  {
    id: "gpt-5",
    name: "gpt5.name",
    description: "gpt5.description",
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
    capabilities: {
      reasoning: false,
      attachments: true,
    },
    showInUI: true,
  },
  {
    id: "gpt-5.1-thinking",
    name: "gpt51Thinking.name",
    description: "gpt51Thinking.description",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: true,
  },
  {
    id: "gpt-5-mini",
    name: "gpt5Mini.name",
    description: "gpt5Mini.description",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: false,
  },
  {
    id: "gemini-2.5-pro",
    name: "gemini25Pro.name",
    description: "gemini25Pro.description",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: false,
  },
  {
    id: "gemini-3-pro",
    name: "gemini3Pro.name",
    description: "gemini3Pro.description",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: true,
  },
  {
    id: "opus-4.1",
    name: "opus41.name",
    description: "opus41.description",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
    showInUI: true,
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

export const supportsAttachments = (modelId: string) => {
  const model = chatModels.find((m) => m.id === modelId);
  return model?.capabilities?.attachments ?? false;
};

export const isVisibleInUI = (modelId: string): boolean => {
  const model = chatModels.find((m) => m.id === modelId);
  return model?.showInUI !== false;
};
