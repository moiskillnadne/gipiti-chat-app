import type { UserType } from "@/app/(auth)/auth";
import type { ChatModel } from "./models";

type Entitlements = {
  availableChatModelIds: ChatModel["id"][];
};

// Model visibility in the UI. Pure pay-per-use means there is no token, quota,
// or feature gating anymore — every authenticated user sees the same catalog.
// This map is kept solely so the model picker can resolve which models to show.
export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users with an account
   */
  regular: {
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
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.4-nano",
      "gpt-5.2-pro",
      "gemini-3.1-pro",
      "gemini-3-pro-image",
      "gemini-3.1-flash-image",
      "grok-imagine-image-pro",
      "gpt-image-1.5",
      "opus-4.6",
      "sonnet-4.6",
      "gpt-codex-5.2",
      "veo-3.1",
      "veo-3.1-fast",
      "grok-imagine-video",
      "flux-2-max",
      "flux-kontext-pro",
      "recraft-v4-pro",
    ],
  },
};
