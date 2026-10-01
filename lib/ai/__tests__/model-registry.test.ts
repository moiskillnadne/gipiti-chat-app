import { describe, expect, it } from "vitest";

import { entitlementsByUserType } from "../entitlements";
import {
  anthropicModelIds,
  type ChatModel,
  chatModels,
  getModelById,
  isAnthropicModel,
  isOpenAIModel,
  openaiModelIds,
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
] as const;

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
      expect(model?.capabilities?.attachments).toBe(true);
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

  it.each(["sonnet-5.5", "fable-5.1"])(
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

  it("strips <think> tags only for the OpenAI additions", () => {
    expect(usesReasoningTagMiddleware("gpt-6.1-sol")).toBe(true);
    expect(usesReasoningTagMiddleware("gpt-6-astra")).toBe(true);
    expect(usesReasoningTagMiddleware("sonnet-5.5")).toBe(false);
    expect(usesReasoningTagMiddleware("fable-5.1")).toBe(false);
  });
});
