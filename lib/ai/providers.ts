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
        "chat-model": gateway.languageModel("xai/grok-2-vision"),
        "chat-model-reasoning": wrapLanguageModel({
          model: gateway.languageModel("xai/grok-3-mini"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "grok-4.1-reasoning": wrapLanguageModel({
          model: gateway.languageModel("xai/grok-4-1-fast-reasoning"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "grok-4.1-non-reasoning": gateway.languageModel(
          "xai/grok-4-1-fast-non-reasoning"
        ),
        "grok-code-fast-1": wrapLanguageModel({
          model: gateway.languageModel("xai/grok-code-fast-1"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "title-model": gateway.languageModel("google/gemini-2.5-flash-lite"),
        "artifact-model": gateway.languageModel("xai/grok-2-vision"),
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
        "gpt-5.2": wrapLanguageModel({
          model: gateway.languageModel("openai/gpt-5.2"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "gpt-5.2-pro": wrapLanguageModel({
          model: gateway.languageModel("openai/gpt-5.2-pro"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "gpt-codex-5.2": wrapLanguageModel({
          model: gateway.languageModel("openai/gpt-5.2-codex"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "gemini-2.5-pro": wrapLanguageModel({
          model: gateway.languageModel("google/gemini-2.5-pro"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "gemini-3-pro": wrapLanguageModel({
          model: gateway.languageModel("google/gemini-3-pro-preview"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "gemini-3-pro-image": gateway.languageModel(
          "google/gemini-3-pro-image"
        ),
        "gpt-image-1.5": gateway.languageModel("openai/dall-e-3"), // Fallback only
        "opus-4.1": wrapLanguageModel({
          model: gateway.languageModel("anthropic/claude-opus-4.1"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "opus-4.6": wrapLanguageModel({
          model: gateway.languageModel("anthropic/claude-opus-4.6"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "sonnet-4.5": wrapLanguageModel({
          model: gateway.languageModel("anthropic/claude-sonnet-4.5"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
      },
    });
