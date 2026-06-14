import type { Geo } from "@vercel/functions";
import type { ModelMessage } from "ai";

import { isReasoningModelId, usesReasoningTagMiddleware } from "./models";

export const regularPrompt =
  "You are a friendly assistant! Keep your responses concise and helpful.";

/**
 * For models wrapped with `extractReasoningMiddleware({tagName:"think"})` in
 * providers.ts (currently OpenAI gpt-5.x only). Both layers must agree: the
 * middleware strips `<think></think>` blocks into the reasoning channel, and
 * this prompt tells the model to emit them.
 */
export const reasoningPrompt = `\
You are a friendly assistant that uses explicit reasoning! When responding:

1. First, wrap your thinking process in <think></think> tags
2. Inside <think> tags, write out your reasoning step-by-step
3. **CRITICAL**: After the </think> tag, you MUST provide your final response to the user
4. Use tools judiciously - aim to call only the most essential tools
5. If you approach your step limit, prioritize providing a final answer over calling more tools

Example:
<think>
The user is asking about X. Let me break this down:
- First consideration: Y
- Second consideration: Z
- Therefore, I should respond with...
</think>

[Your actual response here - THIS IS REQUIRED]

Keep your responses concise and helpful.

IMPORTANT: Every response must include both thinking AND a final answer. Never end with just </think>.`;

/**
 * For models that emit reasoning via a native channel rather than `<think>`
 * tags (Anthropic extended thinking, grok-4.3). Preserves the universally-
 * useful tool-usage and step-limit guidance from `reasoningPrompt` while
 * omitting the tag-format instructions, which would otherwise leak literal
 * `<think>` text into the visible message body.
 */
export const nativeReasoningPrompt = `\
You are a friendly assistant. When responding:
- Keep your responses concise and helpful
- Use tools judiciously — aim to call only the most essential tools
- If you approach your step limit, prioritize providing a final answer over calling more tools`;

export type ProjectContextInput = {
  name: string;
  contextEntries: string[];
};

export type RequestHints = {
  latitude: Geo["latitude"];
  longitude: Geo["longitude"];
  city: Geo["city"];
  country: Geo["country"];
};

/**
 * Build the static system prompt for a chat model. Deterministic per model id —
 * no per-user values, timestamps, or session state — so the byte sequence is
 * identical across all requests for a given model. That stability is what lets
 * the AI Gateway's `caching: "auto"` reuse this prefix across the whole
 * userbase on Anthropic models. Anything per-user goes through
 * `buildContextMessage` instead.
 *
 * Tool-specific guidance (when to call web search, image-prompt best practices,
 * citation format) lives on each tool's `description` field, not here — that
 * way the model sees it during tool selection and we don't pay tokens for it
 * twice.
 */
export const systemPrompt = ({
  selectedChatModel,
}: {
  selectedChatModel: string;
}): string => {
  if (isReasoningModelId(selectedChatModel)) {
    return usesReasoningTagMiddleware(selectedChatModel)
      ? reasoningPrompt
      : nativeReasoningPrompt;
  }
  return regularPrompt;
};

type ContextMessageInput = {
  requestHints: RequestHints;
  projectContext?: ProjectContextInput | null;
};

/**
 * Build a leading user-role context message carrying per-request data
 * (geolocation, active project, future extensions). It lives in `messages`,
 * BELOW the Gateway auto-cache breakpoint, so it never disturbs the cacheable
 * system prefix shared across users.
 *
 * Returns `null` when there's nothing to send — caller skips the prepend.
 *
 * To add a new context field, push a string into `sections` here (e.g. user
 * timezone, plan tier, A/B flag). The model sees them in the order pushed.
 */
export const buildContextMessage = ({
  requestHints,
  projectContext,
}: ContextMessageInput): ModelMessage | null => {
  const sections: string[] = [];

  const locationParts = [requestHints.city, requestHints.country].filter(
    (part): part is string => Boolean(part)
  );
  if (locationParts.length > 0) {
    sections.push(`User location: ${locationParts.join(", ")}.`);
  }

  if (projectContext?.contextEntries.length) {
    const numberedEntries = projectContext.contextEntries
      .map((entry, index) => `  ${index + 1}. "${entry}"`)
      .join("\n");
    sections.push(
      `Active project: "${projectContext.name}".\n${numberedEntries}\n\nUse this project context to inform your responses; do not repeat it verbatim unless asked.`
    );
  }

  if (sections.length === 0) {
    return null;
  }

  const body = sections.join("\n\n");

  return {
    role: "user",
    content: `[Session context — assistant metadata, not a user question]\n\n${body}\n\nRespond in the same language as the user's message.`,
  };
};
