import { describe, expect, it } from "vitest";

import ru from "../../../messages/ru.json" with { type: "json" };
import { entitlementsByUserType } from "../entitlements";
import {
  anthropicModelIds,
  type ChatModel,
  chatModels,
  getDedicatedImageGatewayModelId,
  getMediaCostEstimateUsd,
  getModelById,
  getOpenAIImageGatewayModelId,
  getVideoGenConfig,
  isAnthropicModel,
  isDedicatedImageModel,
  isImageGenerationModel,
  isOpenAIModel,
  isVideoGenerationModel,
  openaiModelIds,
  supportsImageGenConfig,
  supportsPdfInput,
  supportsToolCalling,
  usesReasoningTagMiddleware,
  validateVideoGenSetting,
} from "../models";
import { myProvider } from "../providers";
import { isRecraftModel } from "../recraft-client";

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
  "gpt-6.2-sol",
  "gpt-6.2-astra",
  "fable-5.2",
  "gemini-4-neon",
  "gemini-4-hydrogen",
  "gemini-4-carbon",
  "qwen4-max",
  "muse-ember",
] as const;

// Image and video models added 2026-11-20, with the gateway id each one is
// served by and the cost estimate the balance gate uses.
const NOVEMBER_MEDIA_MODELS = [
  { id: "gpt-image-2.6-sunburst", gatewayId: "openai/gpt-image-2.6-sunburst" },
  { id: "gpt-image-2.6-flare", gatewayId: "openai/gpt-image-2.6-flare" },
  { id: "mai-image-2.7", gatewayId: "microsoft/mai-image-2.7" },
  { id: "mai-image-2.7-flash", gatewayId: "microsoft/mai-image-2.7-flash" },
  { id: "seedream-5.5", gatewayId: "bytedance/seedream-5.5" },
  { id: "flux-3-image-klein", gatewayId: "bfl/flux-3-image-klein" },
  { id: "recraft-v4.1-flash", gatewayId: "recraft/recraft-v4.1-flash" },
] as const;

const NOVEMBER_ESTIMATED_COSTS_USD: Record<string, number> = {
  "gpt-image-2.6-sunburst": 0.1,
  "gpt-image-2.6-flare": 0.14,
  "mai-image-2.7": 0.045,
  "mai-image-2.7-flash": 0.014,
  "seedream-5.5": 0.05,
  "flux-3-image-klein": 0.012,
  "recraft-v4.1-flash": 0.007,
  "seedance-2.5-flash": 1.6,
  "grok-imagine-video-lite": 0.4,
};

const NOVEMBER_TEXT_MODEL_IDS = [
  "gpt-6.2-sol",
  "gpt-6.2-astra",
  "fable-5.2",
  "gemini-4-neon",
  "gemini-4-hydrogen",
  "gemini-4-carbon",
  "qwen4-max",
  "muse-ember",
] as const;

const NOVEMBER_IMAGE_MODEL_IDS = NOVEMBER_MEDIA_MODELS.map((model) => model.id);

const NOVEMBER_VIDEO_MODEL_IDS = [
  "seedance-2.5-flash",
  "grok-imagine-video-lite",
] as const;

const NOVEMBER_MODEL_IDS = [
  ...NOVEMBER_TEXT_MODEL_IDS,
  ...NOVEMBER_IMAGE_MODEL_IDS,
  ...NOVEMBER_VIDEO_MODEL_IDS,
];

/** Resolves "namespace.key" against the Russian message bundle. */
const hasRussianModelText = (nameKey: string): boolean => {
  const [group, field] = nameKey.split(".");
  const entry = (ru.modelList as Record<string, Record<string, unknown>>)[
    group
  ];
  return typeof entry?.[field] === "string";
};

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

  it.each(["gpt-6.1-sol", "gpt-6-astra", "gpt-6.2-sol", "gpt-6.2-astra"])(
    "never offers a no-reasoning level for %s",
    (modelId) => {
      // The gateway accepts "none" for these models but silently treats it as
      // the default effort, so the picker option would do nothing.
      expect(getEffortValues(modelId)).not.toContain("none");
      expect(getEffortValues(modelId)).toContain("auto");
    }
  );

  it.each(["sonnet-5.5", "fable-5.1", "fable-5.2", "haiku-5.5"])(
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

  it("offers Wan 3.0 only as a 5 s clip and coerces a saved 10 s setting", () => {
    // Probed 2026-10-29: Wan defaults to 1080p at $0.20/s and a 5 s clip took
    // 130 s, so a 10 s clip risked the then 300 s route limit (now 800 s)
    // before it is charged; it stays off until timed on prod.
    const durations = getVideoGenConfig("wan-v3.0-video").duration?.options.map(
      (option) => option.value
    );
    expect(durations).toEqual(["5"]);
    expect(
      validateVideoGenSetting("wan-v3.0-video", { duration: "10" })?.duration
    ).toBe("5");
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

  // Both Pro ids left the gateway catalog (probed 2026-10-29); old chats must
  // reach plain Sonar and be priced at Sonar's rate.
  it.each(HIDDEN_LEGACY_MODEL_IDS)(
    "routes %s to perplexity/sonar",
    (modelId) => {
      expect(myProvider.languageModel(modelId).modelId).toBe(
        "perplexity/sonar"
      );
    }
  );

  it("strips <think> tags only for the OpenAI additions", () => {
    expect(usesReasoningTagMiddleware("gpt-6.1-terra")).toBe(true);
    // MiniMax is wrapped in providers.ts as a no-op guard, never prompted.
    expect(usesReasoningTagMiddleware("minimax-m3.1-flash")).toBe(false);
    expect(usesReasoningTagMiddleware("gpt-6.1-sol")).toBe(true);
    expect(usesReasoningTagMiddleware("gpt-6-astra")).toBe(true);
    expect(usesReasoningTagMiddleware("gpt-6.2-sol")).toBe(true);
    expect(usesReasoningTagMiddleware("gpt-6.2-astra")).toBe(true);
    expect(usesReasoningTagMiddleware("fable-5.2")).toBe(false);
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

  it.each(NOVEMBER_MODEL_IDS)(
    "lists %s in the entitlements with Russian name and description",
    (modelId) => {
      const model = getModelById(modelId);

      expect(model?.showInUI).toBe(true);
      expect(entitlementsByUserType.regular.availableChatModelIds).toContain(
        modelId
      );
      expect(hasRussianModelText(model?.name ?? "")).toBe(true);
      expect(hasRussianModelText(model?.description ?? "")).toBe(true);
    }
  );

  it("uses the Gemini 4 picker with no xhigh level", () => {
    for (const modelId of [
      "gemini-4-neon",
      "gemini-4-hydrogen",
      "gemini-4-carbon",
    ]) {
      expect(getEffortValues(modelId)).toEqual(["auto", "low", "high"]);
    }
  });

  it("offers no reasoning picker for Qwen 4 Max and Muse Ember", () => {
    expect(getModelById("qwen4-max")?.thinkingConfig).toBeUndefined();
    expect(getModelById("muse-ember")?.thinkingConfig).toBeUndefined();
  });

  it.each(NOVEMBER_MEDIA_MODELS)(
    "routes $id to $gatewayId",
    ({ id, gatewayId }) => {
      const isOpenAI = id.startsWith("gpt-image");

      expect(
        isOpenAI
          ? getOpenAIImageGatewayModelId(id)
          : getDedicatedImageGatewayModelId(id)
      ).toBe(gatewayId);
      expect(isDedicatedImageModel(id)).toBe(!isOpenAI);
    }
  );

  it.each(Object.entries(NOVEMBER_ESTIMATED_COSTS_USD))(
    "gates %s at an estimated cost of $%s",
    (modelId, expectedCostUsd) => {
      expect(getMediaCostEstimateUsd(modelId)).toBe(expectedCostUsd);
    }
  );

  it("offers the 1:1, 16:9 and 9:16 ratio picker on MAI 2.7 and Klein only", () => {
    const ratioValues = (modelId: string): string[] =>
      getModelById(modelId)?.imageGenConfig?.aspectRatio?.options.map(
        (option) => option.value
      ) ?? [];

    for (const modelId of [
      "mai-image-2.7",
      "mai-image-2.7-flash",
      "flux-3-image-klein",
    ]) {
      expect(ratioValues(modelId)).toEqual(["1:1", "16:9", "9:16"]);
      expect(getModelById(modelId)?.imageGenConfig?.aspectRatio?.default).toBe(
        "1:1"
      );
    }
    expect(ratioValues("mai-image-2.6")).toEqual([]);
  });

  it("serves Recraft Flash through the dedicated map, never the Pro client", () => {
    // recraft-client.ts hard-codes the Pro gateway id: Flash routed through it
    // would be served and billed as Pro.
    expect(isRecraftModel("recraft-v4.1-flash")).toBe(false);
    expect(getDedicatedImageGatewayModelId("recraft-v4.1-flash")).toBe(
      "recraft/recraft-v4.1-flash"
    );
  });

  it("keeps Recraft Flash text-to-image only, without an empty settings pill", () => {
    const model = getModelById("recraft-v4.1-flash");

    expect(model?.capabilities?.attachments).toBeUndefined();
    // The config only carries the cost estimate: nothing to pick.
    expect(supportsImageGenConfig("recraft-v4.1-flash")).toBe(false);
    expect(supportsImageGenConfig("mai-image-2.7")).toBe(true);
  });

  it("offers Seedance 2.5 Flash as 5 s and 10 s clips from text or one image", () => {
    const config = getVideoGenConfig("seedance-2.5-flash");

    expect(config.gatewayModelId).toBe("bytedance/seedance-2.5-flash");
    expect(config.imageInput).toBe("optional");
    expect(config.duration?.options.map((option) => option.value)).toEqual([
      "5",
      "10",
    ]);
  });

  it("serves Grok Imagine Video Lite through the spacexai namespace", () => {
    const config = getVideoGenConfig("grok-imagine-video-lite");

    expect(config.gatewayModelId).toBe("spacexai/grok-imagine-video-1.5-lite");
    expect(config.resolution?.options.map((option) => option.value)).toEqual([
      "480p",
      "720p",
    ]);
  });
});

describe("PDF input capability", () => {
  it("marks only Qwen 4 Max as rejecting PDF files", () => {
    const rejecting = chatModels
      .filter((model) => model.capabilities?.pdfInput === false)
      .map((model) => model.id);

    expect(rejecting).toEqual(["qwen4-max"]);
  });

  it("treats a model without the flag, and an unknown id, as accepting PDFs", () => {
    expect(supportsPdfInput("qwen4-max")).toBe(false);
    expect(supportsPdfInput("muse-ember")).toBe(true);
    expect(supportsPdfInput("gpt-6.2-sol")).toBe(true);
    expect(supportsPdfInput("not-a-model")).toBe(true);
  });
});
