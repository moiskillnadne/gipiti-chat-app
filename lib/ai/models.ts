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
    name: "Grok Vision",
    description: "Advanced multimodal model with vision and text capabilities",
    capabilities: {
      attachments: true,
    },
  },
  {
    id: "chat-model-reasoning",
    name: "Grok Reasoning",
    description:
      "Uses advanced chain-of-thought reasoning for complex problems",
    capabilities: {
      reasoning: true,
      attachments: false,
    },
  },
  {
    id: "gpt-5",
    name: "GPT-5",
    description:
      "Uses advanced chain-of-thought reasoning for complex problems.",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
  },
  {
    id: "gpt-5-pro",
    name: "GPT-5 Pro",
    description:
      "The smartest version of OpenAI's GPT model. Good for super complex tasks.",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
  },
  {
    id: "gpt-5-mini",
    name: "GPT-5 Mini",
    description:
      "The smallest version of OpenAI's GPT model. Good for quick tasks.",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    description:
      "The latest version of Google's Gemini model. Good for daily tasks.",
    capabilities: {
      reasoning: true,
      attachments: true,
    },
  },
  {
    id: "opus-4.1",
    name: "Opus 4.1",
    description:
      "The latest version of Anthropic's Opus model. Good for daily tasks.",
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
