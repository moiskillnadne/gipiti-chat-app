import type { UserType } from "@/app/(auth)/auth";
import type { ChatModel } from "./models";

type Entitlements = {
  maxMessagesPerDay: number;
  availableChatModelIds: ChatModel["id"][];
};

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: 100,
    availableChatModelIds: [
      "chat-model",
      "chat-model-reasoning",
      "grok-4.1-reasoning",
      "grok-4.1-non-reasoning",
      "grok-code-fast-1",
      "gpt-5",
      "gpt-5.1-instant",
      "gpt-5.1-thinking",
      "gpt-5.2",
      "gpt-5.2-pro",
      "gemini-3.1-pro",
      "gemini-3-pro-image",
      "gemini-3.1-flash-image",
      "gpt-image-1.5",
      "opus-4.6",
      "sonnet-4.6",
      "gpt-codex-5.2",
      "veo-3.1",
      "veo-3.1-fast",
    ],
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};
