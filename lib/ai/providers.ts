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
    // All Grok text models use the gateway's canonical "spacexai/" id rather
    // than the "xai/" alias (kept by the gateway only as a redirect): TokenLens
    // prices the alias from models.dev's xai entry ($2/$6 per 1M), while the
    // gateway bills grok-4.7 at $1.2/$3.6 — only the "spacexai/" id resolves to
    // the gateway's real price.
    "grok-4.7": gateway.languageModel("spacexai/grok-4.7"),
    "grok-4.6": gateway.languageModel("spacexai/grok-4.6"),
    "grok-4.5": gateway.languageModel("spacexai/grok-4.5"),
    "grok-4.3": gateway.languageModel("spacexai/grok-4.3"),
    "title-model": gateway.languageModel("google/gemini-3.1-flash-lite"),
    "gpt-6.1-terra": wrapLanguageModel({
      model: gateway.languageModel("openai/gpt-6.1-terra"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    "gpt-6.1-sol": wrapLanguageModel({
      model: gateway.languageModel("openai/gpt-6.1-sol"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    "gpt-6-astra": wrapLanguageModel({
      model: gateway.languageModel("openai/gpt-6-astra"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    "gpt-6-sol": wrapLanguageModel({
      model: gateway.languageModel("openai/gpt-6-sol"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    "gpt-6-luna": wrapLanguageModel({
      model: gateway.languageModel("openai/gpt-6-luna"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
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
    "gemini-4-argon": gateway.languageModel("google/gemini-4-argon"),
    "gemini-3.1-pro": gateway.languageModel("google/gemini-3.1-pro-preview"),
    "gemini-3.8-flash": gateway.languageModel("google/gemini-3.8-flash"),
    "gemini-3.7-flash": gateway.languageModel("google/gemini-3.7-flash"),
    "gemini-3.6-flash": gateway.languageModel("google/gemini-3.6-flash"),
    "gemini-3.5-flash": gateway.languageModel("google/gemini-3.5-flash"),
    "gemini-3.5-flash-lite": gateway.languageModel(
      "google/gemini-3.5-flash-lite"
    ),
    "nano-banana-2.1": gateway.languageModel("google/gemini-nano-banana-2.1"),
    "gemini-3-pro-image": gateway.languageModel("google/gemini-3-pro-image"),
    "gemini-3.1-flash-image": gateway.languageModel(
      "google/gemini-3.1-flash-image"
    ),
    "gemini-3.1-flash-lite-image": gateway.languageModel(
      "google/gemini-3.1-flash-lite-image"
    ),
    "fable-5.1": gateway.languageModel("anthropic/claude-fable-5.1"),
    "opus-5.5": gateway.languageModel("anthropic/claude-opus-5.5"),
    "opus-5": gateway.languageModel("anthropic/claude-opus-5"),
    "opus-4.8": gateway.languageModel("anthropic/claude-opus-4.8"),
    "sonnet-5.5": gateway.languageModel("anthropic/claude-sonnet-5.5"),
    "sonnet-5": gateway.languageModel("anthropic/claude-sonnet-5"),
    "sonnet-4.6": gateway.languageModel("anthropic/claude-sonnet-4.6"),
    "haiku-5.5": gateway.languageModel("anthropic/claude-haiku-5.5"),
    "haiku-4.5": gateway.languageModel("anthropic/claude-haiku-4.5"),
    // DeepSeek streams reasoning natively (reasoning_content, normalized by
    // the Gateway to reasoning parts) — no extractReasoningMiddleware wrapper,
    // same as grok-4.3 above.
    "deepseek-v4.1-flash-1017": gateway.languageModel(
      "deepseek/deepseek-v4.1-flash-1017"
    ),
    "deepseek-v4.1-flash": gateway.languageModel(
      "deepseek/deepseek-v4.1-flash"
    ),
    "deepseek-v4-pro": gateway.languageModel("deepseek/deepseek-v4-pro"),
    "deepseek-v4-flash": gateway.languageModel("deepseek/deepseek-v4-flash"),
    // Moonshot and Alibaba stream reasoning natively too (reasoning_content,
    // normalized by the Gateway) — verified against the live gateway, no
    // <think> tags in the text stream, so no middleware wrapper.
    "kimi-k3.1-pro": gateway.languageModel("moonshotai/kimi-k3.1-pro"),
    "kimi-k3-fast": gateway.languageModel("moonshotai/kimi-k3-fast"),
    "qwen3.8-max-prime": gateway.languageModel("alibaba/qwen3.8-max-prime"),
    "qwen3.8-max": gateway.languageModel("alibaba/qwen3.8-max"),
    "qwen3.8-flash": gateway.languageModel("alibaba/qwen3.8-flash"),
    "qwen3.7-flash": gateway.languageModel("alibaba/qwen3.7-flash"),
    // Meta, Mistral, Z.ai and Xiaomi are assumed to stream reasoning natively
    // through the gateway (reasoning parts, no <think> tags in the text) —
    // unverified against the live gateway; add extractReasoningMiddleware here
    // if a smoke test shows literal <think> tags in the answer.
    "muse-wonder-1.0": gateway.languageModel("meta/muse-wonder-1.0"),
    "muse-spark-1.3": gateway.languageModel("meta/muse-spark-1.3"),
    "mistral-large-4": gateway.languageModel("mistral/mistral-large-4"),
    "glm-5.3": gateway.languageModel("zai/glm-5.3"),
    // MiniMax M-series emit their chain of thought as literal <think> tags in
    // the text stream, so strip them into reasoning parts. A no-op when the
    // gateway already normalises reasoning. Like sonar-reasoning-pro below, the
    // model emits the tags unprompted — usesReasoningTagMiddleware in models.ts
    // stays false for it (no <think> instruction in the system prompt).
    "minimax-m3.1-flash": wrapLanguageModel({
      model: gateway.languageModel("minimax/minimax-m3.1-flash"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    "mimo-v2.6-pro": gateway.languageModel("xiaomi/mimo-v2.6-pro"),
    sonar: gateway.languageModel("perplexity/sonar"),
    // sonar-pro and sonar-reasoning-pro are hidden from the picker (the gateway
    // now serves both as plain Sonar) but stay registered so old chats and
    // saved model cookies still resolve.
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
