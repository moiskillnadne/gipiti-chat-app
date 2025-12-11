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
      "gpt-5",
      "gpt-5.1-instant",
      "gpt-5.1-thinking",
      "gpt-5.2",
      "gemini-3-pro",
      "opus-4.1",
    ],
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};
