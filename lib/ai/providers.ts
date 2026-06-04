import { gateway } from "@ai-sdk/gateway";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";

export const myProvider = customProvider({
  languageModels: {
    // xAI grok-4.x streams reasoning natively (not <think> tags), so no
    // extractReasoningMiddleware wrapper here.
    "grok-4.3": gateway.languageModel("xai/grok-4.3"),
    "title-model": gateway.languageModel("google/gemini-3.1-flash-lite"),
    "gpt-5.5": wrapLanguageModel({
      model: gateway.languageModel("openai/gpt-5.5"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    "gpt-5.4-mini": wrapLanguageModel({
      model: gateway.languageModel("openai/gpt-5.4-mini"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    "gpt-5.4-nano": wrapLanguageModel({
      model: gateway.languageModel("openai/gpt-5.4-nano"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    "gpt-codex-5.3": wrapLanguageModel({
      model: gateway.languageModel("openai/gpt-5.3-codex"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    "gemini-3.1-pro": wrapLanguageModel({
      model: gateway.languageModel("google/gemini-3.1-pro-preview"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    "gemini-3.5-flash": wrapLanguageModel({
      model: gateway.languageModel("google/gemini-3.5-flash"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    "gemini-3-pro-image": gateway.languageModel("google/gemini-3-pro-image"),
    "gemini-3.1-flash-image": gateway.languageModel(
      "google/gemini-3.1-flash-image"
    ),
    "opus-4.8": gateway.languageModel("anthropic/claude-opus-4.8"),
    "sonnet-4.6": gateway.languageModel("anthropic/claude-sonnet-4.6"),
    "haiku-4.5": gateway.languageModel("anthropic/claude-haiku-4.5"),
  },
});
