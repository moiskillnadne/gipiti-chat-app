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
    "grok-4.5": gateway.languageModel("xai/grok-4.5"),
    "grok-4.3": gateway.languageModel("xai/grok-4.3"),
    "title-model": gateway.languageModel("google/gemini-3.1-flash-lite"),
    "gpt-5.6-sol": wrapLanguageModel({
      model: gateway.languageModel("openai/gpt-5.6-sol"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    "gpt-5.6-terra": wrapLanguageModel({
      model: gateway.languageModel("openai/gpt-5.6-terra"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    "gpt-5.6-luna": wrapLanguageModel({
      model: gateway.languageModel("openai/gpt-5.6-luna"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
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
    // Gemini 3 streams reasoning natively (with thought signatures), not
    // <think> tags, so no extractReasoningMiddleware wrapper — same as grok-4.3
    // above. Wrapping it mangles the thoughtSignature on persisted assistant
    // turns and breaks multi-turn tool-call continuations (400 "Corrupted
    // thought signature").
    "gemini-3.1-pro": gateway.languageModel("google/gemini-3.1-pro-preview"),
    "gemini-3.5-flash": gateway.languageModel("google/gemini-3.5-flash"),
    "gemini-3-pro-image": gateway.languageModel("google/gemini-3-pro-image"),
    "gemini-3.1-flash-image": gateway.languageModel(
      "google/gemini-3.1-flash-image"
    ),
    "gemini-3.1-flash-lite-image": gateway.languageModel(
      "google/gemini-3.1-flash-lite-image"
    ),
    "opus-4.8": gateway.languageModel("anthropic/claude-opus-4.8"),
    "sonnet-5": gateway.languageModel("anthropic/claude-sonnet-5"),
    "sonnet-4.6": gateway.languageModel("anthropic/claude-sonnet-4.6"),
    "haiku-4.5": gateway.languageModel("anthropic/claude-haiku-4.5"),
    // DeepSeek streams reasoning natively (reasoning_content, normalized by
    // the Gateway to reasoning parts) — no extractReasoningMiddleware wrapper,
    // same as grok-4.3 above.
    "deepseek-v4-pro": gateway.languageModel("deepseek/deepseek-v4-pro"),
    "deepseek-v4-flash": gateway.languageModel("deepseek/deepseek-v4-flash"),
    sonar: gateway.languageModel("perplexity/sonar"),
    "sonar-pro": gateway.languageModel("perplexity/sonar-pro"),
    // Perplexity puts CoT as literal <think> tags inside the text stream (no
    // native reasoning parts), so strip them into reasoning parts here. The
    // model emits the tags unprompted — usesReasoningTagMiddleware in models.ts
    // stays false for it (no <think> instruction in the system prompt).
    "sonar-reasoning-pro": wrapLanguageModel({
      model: gateway.languageModel("perplexity/sonar-reasoning-pro"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
  },
});
