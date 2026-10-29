import { describe, expect, it } from "vitest";

import ru from "../../../messages/ru.json" with { type: "json" };
import { entitlementsByUserType } from "../entitlements";
import {
  anthropicModelIds,
  type ChatModel,
  chatModels,
  getDedicatedImageGatewayModelId,
  getModelById,
  getVideoGenConfig,
  isAnthropicModel,
  isDedicatedImageModel,
  isImageGenerationModel,
  isOpenAIModel,
  isVideoGenerationModel,
  openaiModelIds,
  supportsToolCalling,
  usesReasoningTagMiddleware,
} from "../models";
import { myProvider } from "../providers";

const isTextChatModel = (model: ChatModel): boolean =>
  model.showInUI !== false &&
  !model.capabilities?.imageGeneration &&
  !model.capabilities?.videoGeneration;

const textChatModels = chatModels.filter(isTextChatModel);

const NEW_MODEL_IDS = [
  "gpt-6.1-sol",
  "gpt-6-astra",
  "sonnet-5.5",
  "fable-5.1",
  "haiku-5.5",
  "gpt-6.1-terra",
  "gemini-4-argon",
  "kimi-k3.1-pro",
  "muse-wonder-1.0",
  "muse-spark-1.3",
  "qwen3.8-max-prime",
  "qwen3.8-flash",
  "deepseek-v4.1-flash-1017",
  "mistral-large-4",
  "glm-5.3",
  "minimax-m3.1-flash",
  "mimo-v2.6-pro",
] as const;

// Models the gateway no longer serves as themselves: hidden from the picker
// but still registered so old chats and saved cookies resolve.
const HIDDEN_LEGACY_MODEL_IDS = ["sonar-pro", "sonar-reasoning-pro"] as const;

const getEffortValues = (modelId: string): readonly string[] => {
  const thinkingConfig = getModelById(modelId)?.thinkingConfig;
  return thinkingConfig?.type === "effort" ? thinkingConfig.values : [];
};

describe("text chat model registry wiring", () => {
  it("registers every visible text model with the language-model provider", () => {
    const unregistered = textChatModels
      .filter((model) => {
        try {
          myProvider.languageModel(model.id);
          return false;
        } catch {
          return true;
        }
      })
      .map((model) => model.id);

    expect(unregistered).toEqual([]);
  });

  it("lists every visible text model in the regular entitlements", () => {
    const entitledIds = new Set(
      entitlementsByUserType.regular.availableChatModelIds
    );
    const missing = textChatModels
      .filter((model) => !entitledIds.has(model.id))
      .map((model) => model.id);

    expect(missing).toEqual([]);
  });

  it("keeps the provider id lists in sync with the registry", () => {
    const openaiTextIds = textChatModels
      .filter((model) => model.provider === "openai")
      .map((model) => model.id);
    const anthropicTextIds = textChatModels
      .filter((model) => model.provider === "anthropic")
      .map((model) => model.id);

    expect(openaiTextIds.filter((id) => !isOpenAIModel(id))).toEqual([]);
    expect(anthropicTextIds.filter((id) => !isAnthropicModel(id))).toEqual([]);
    expect(
      openaiModelIds.filter((id) => getModelById(id)?.provider !== "openai")
    ).toEqual([]);
    expect(
      anthropicModelIds.filter(
        (id) => getModelById(id)?.provider !== "anthropic"
      )
    ).toEqual([]);
  });
});

describe("newly added models", () => {
  it.each(NEW_MODEL_IDS)(
    "exposes %s as a visible reasoning model",
    (modelId) => {
      const model = getModelById(modelId);

      expect(model?.showInUI).toBe(true);
      expect(model?.capabilities?.reasoning).toBe(true);
      // GLM-5.3 is text-only; every other addition accepts images.
      expect(Boolean(model?.capabilities?.attachments)).toBe(
        modelId !== "glm-5.3"
      );
    }
  );

  it.each(["gpt-6.1-sol", "gpt-6-astra"])(
    "never offers a no-reasoning level for %s",
    (modelId) => {
      // The gateway accepts "none" for these models but silently treats it as
      // the default effort, so the picker option would do nothing.
      expect(getEffortValues(modelId)).not.toContain("none");
      expect(getEffortValues(modelId)).toContain("auto");
    }
  );

  it.each(["sonnet-5.5", "fable-5.1", "haiku-5.5"])(
    "offers only effort levels the Anthropic API accepts for %s",
    (modelId) => {
      // anthropic.effort = "none" is rejected as "invalid anthropic provider options".
      expect(getEffortValues(modelId)).toEqual([
        "auto",
        "low",
        "medium",
        "high",
      ]);
    }
  );

  it("offers the GPT-6.1 Terra effort picker with a no-reasoning level", () => {
    expect(getEffortValues("gpt-6.1-terra")).toContain("none");
    expect(getEffortValues("gemini-4-argon")).toEqual(["auto", "low", "high"]);
  });

  it("keeps the new image and video models wired to the right pipeline", () => {
    expect(isDedicatedImageModel("flux-3-image")).toBe(true);
    expect(isDedicatedImageModel("mai-image-2.6")).toBe(true);
    expect(isDedicatedImageModel("mai-image-2.6-flash")).toBe(true);
    expect(getDedicatedImageGatewayModelId("flux-3-image")).toBe(
      "bfl/flux-3-image"
    );
    expect(getDedicatedImageGatewayModelId("mai-image-2.6")).toBe(
      "microsoft/mai-image-2.6"
    );
    // Nano Banana 2.1 is a multimodal language model, not a dedicated one.
    expect(isImageGenerationModel("nano-banana-2.1")).toBe(true);
    expect(isDedicatedImageModel("nano-banana-2.1")).toBe(false);
    expect(isVideoGenerationModel("wan-v3.0-video")).toBe(true);
    expect(getVideoGenConfig("wan-v3.0-video").gatewayModelId).toBe(
      "alibaba/wan-v3.0-video"
    );
  });

  it("uses the spacexai namespace for every Grok gateway id", () => {
    expect(getVideoGenConfig("grok-imagine-video").gatewayModelId).toBe(
      "spacexai/grok-imagine-video-1.5"
    );
    expect(getDedicatedImageGatewayModelId("grok-imagine-image")).toBe(
      "spacexai/grok-imagine-image"
    );
    expect(getDedicatedImageGatewayModelId("grok-imagine-image-2.0")).toBe(
      "spacexai/grok-imagine-image-2.0"
    );
  });

  it.each(HIDDEN_LEGACY_MODEL_IDS)(
    "hides %s from the picker but keeps it resolvable",
    (modelId) => {
      expect(getModelById(modelId)?.showInUI).toBe(false);
      expect(myProvider.languageModel(modelId)).toBeDefined();
      expect(
        entitlementsByUserType.regular.availableChatModelIds
      ).not.toContain(modelId);
    }
  );

  it("strips <think> tags only for the OpenAI additions", () => {
    expect(usesReasoningTagMiddleware("gpt-6.1-terra")).toBe(true);
    // MiniMax is wrapped in providers.ts but emits <think> unprompted.
    expect(usesReasoningTagMiddleware("minimax-m3.1-flash")).toBe(false);
    expect(usesReasoningTagMiddleware("gpt-6.1-sol")).toBe(true);
    expect(usesReasoningTagMiddleware("gpt-6-astra")).toBe(true);
    expect(usesReasoningTagMiddleware("sonnet-5.5")).toBe(false);
    expect(usesReasoningTagMiddleware("fable-5.1")).toBe(false);
    expect(usesReasoningTagMiddleware("haiku-5.5")).toBe(false);
  });

  it("has a picker group label for every model provider", () => {
    const labels: Record<string, unknown> = ru.modelList.providers;
    const providers = chatModels.flatMap((model) =>
      model.provider ? [model.provider] : []
    );
    const missing = [...new Set(providers)].filter(
      (provider) => typeof labels[provider] !== "string"
    );

    expect(missing).toEqual([]);
  });

  it("keeps tool calling on for text-only reasoning models", () => {
    // The step budget in prepare-chat-turn.ts keys off supportsToolCalling,
    // so GLM must not be flagged as tool-less.
    expect(supportsToolCalling("glm-5.3")).toBe(true);
    expect(supportsToolCalling("sonar")).toBe(false);
  });
});
