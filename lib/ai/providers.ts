import { gateway } from "@ai-sdk/gateway";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "chat-model-reasoning": reasoningModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        "chat-model": gateway.languageModel("xai/grok-2-vision-1212"),
        "chat-model-reasoning": wrapLanguageModel({
          model: gateway.languageModel("xai/grok-3-mini"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "title-model": gateway.languageModel("xai/grok-2-1212"),
        "artifact-model": gateway.languageModel("xai/grok-2-1212"),
        "gpt-5": wrapLanguageModel({
          model: gateway.languageModel("openai/gpt-5"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "gpt-5-mini": wrapLanguageModel({
          model: gateway.languageModel("openai/gpt-5-mini"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "gpt-5.1-instant": gateway.languageModel("openai/gpt-5.1-instant"),
        "gpt-5.1-thinking": wrapLanguageModel({
          model: gateway.languageModel("openai/gpt-5.1-thinking"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "gemini-2.5-pro": wrapLanguageModel({
          model: gateway.languageModel("google/gemini-2.5-pro"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "opus-4.1": wrapLanguageModel({
          model: gateway.languageModel("anthropic/claude-opus-4.1"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
      },
    });
