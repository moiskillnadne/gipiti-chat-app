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
      "grok-4.3",
      "gpt-5.5",
      "gpt-5.4-mini",
      "gpt-5.4-nano",
      "gpt-codex-5.3",
      "gemini-3.1-pro",
      "gemini-3.5-flash",
      "opus-4.8",
      "sonnet-4.6",
      "haiku-4.5",
      "gemini-3-pro-image",
      "gemini-3.1-flash-image",
      "grok-imagine-image",
      "gpt-image-2",
      "flux-2-max",
      "flux-kontext-max",
      "recraft-v4.1-pro",
      "veo-3.1",
      "veo-3.1-fast",
      "grok-imagine-video",
    ],
  },
};
