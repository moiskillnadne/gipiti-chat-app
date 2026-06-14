import type { SharedV2ProviderOptions } from "@ai-sdk/provider";
import {
  convertToModelMessages,
  type ModelMessage,
  stepCountIs,
  streamText,
} from "ai";
import {
  getProviderOptions,
  isAutoReasoning,
  isGoogleModel,
  isReasoningModelId,
  supportsThinkingConfig,
} from "@/lib/ai/models";
import { buildContextMessage, systemPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { resolveLatestImageUrl } from "@/lib/ai/resolve-latest-image";
import { calculator } from "@/lib/ai/tools/calculator";
import { extractUrl } from "@/lib/ai/tools/extract-url";
import { generateImage } from "@/lib/ai/tools/generate-image";
import { generatePdf } from "@/lib/ai/tools/generate-pdf";
import { webSearch } from "@/lib/ai/tools/web-search";
import {
  isGeminiSignatureDebugEnabled,
  isProductionEnvironment,
} from "@/lib/constants";
import { chargeUsageSafe } from "../charge";
import type { ChatTurnContext, StreamWriter } from "../context";
import { getTokenlensCatalog, mergeUsage, usageChargeUsd } from "../usage";

const FINAL_ANSWER_REMINDER =
  "Please provide your final answer now based on the information you've gathered. Do not call any more tools.";

type GooglePayloadPartSummary = {
  type: string;
  signatureProvider?: string;
  signatureLength?: number;
};

type GooglePayloadMessageSummary = {
  index: number;
  role: ModelMessage["role"];
  parts: GooglePayloadPartSummary[];
};

/**
 * Locate a Gemini `thoughtSignature` under any provider key (it lands under
 * `vertex` or `google` depending on which backend the Gateway routed to) and
 * report only its provider + length — never the raw base64.
 */
function findThoughtSignature(
  providerOptions: SharedV2ProviderOptions | undefined
): { provider: string; length: number } | null {
  if (!providerOptions) {
    return null;
  }

  for (const [provider, values] of Object.entries(providerOptions)) {
    const signature = (values as { thoughtSignature?: unknown })
      ?.thoughtSignature;
    if (typeof signature === "string") {
      return { provider, length: signature.length };
    }
  }

  return null;
}

/**
 * Build a value-free summary of the model messages bound for Google: per part,
 * which provider key (if any) still carries a thought signature and its length.
 * After the GIPITI-82 fix this should report no signatures on historical parts —
 * confirming they were stripped before replay — without leaking them into logs.
 */
function summarizeGoogleSignaturePayload(
  messages: ModelMessage[]
): GooglePayloadMessageSummary[] {
  return messages.map((message, index) => {
    const { content } = message;

    if (!Array.isArray(content)) {
      return { index, role: message.role, parts: [] };
    }

    const parts = content.map((part): GooglePayloadPartSummary => {
      const providerOptions = (
        part as { providerOptions?: SharedV2ProviderOptions }
      ).providerOptions;
      const signature = findThoughtSignature(providerOptions);

      if (signature) {
        return {
          type: part.type,
          signatureProvider: signature.provider,
          signatureLength: signature.length,
        };
      }

      return { type: part.type };
    });

    return { index, role: message.role, parts };
  });
}

/**
 * `convertToModelMessages` can emit an assistant message with no content — e.g.
 * a multi-step turn whose leading parts are UI-data/step markers, or a prior
 * failed turn persisted as data-only. Gemini rejects empty content with a 400
 * "must include at least one parts field", so these are dropped before
 * streaming. (GIPITI-82)
 */
function isEmptyAssistantMessage(message: ModelMessage): boolean {
  return (
    message.role === "assistant" &&
    Array.isArray(message.content) &&
    message.content.length === 0
  );
}

/**
 * Run a standard text-chat turn via streamText: build the system prompt, expose
 * the tool set (gated by model capability + web-search toggle), stream the
 * reply, and on finish enrich usage via TokenLens and charge the cost. The
 * merged usage is stashed on ctx for last-context persistence.
 */
export async function runTextChat(
  ctx: ChatTurnContext,
  writer: StreamWriter
): Promise<void> {
  const { model, thinkingSetting, stepLimit } = ctx;

  const providerOptions = getProviderOptions(model, thinkingSetting);

  const isThinkingEnabled =
    supportsThinkingConfig(model) &&
    thinkingSetting &&
    !(thinkingSetting.type === "effort" && thinkingSetting.value === "none") &&
    !(thinkingSetting.type === "budget" && thinkingSetting.value === 0);

  // Static system prompt + dynamic context as a leading message keeps the
  // system block byte-identical across users so the Gateway cache prefix is
  // shared. Per-user data (geolocation, project) lives below the cache line.
  const baseMessages = (await convertToModelMessages(ctx.uiMessages)).filter(
    (message) => !isEmptyAssistantMessage(message)
  );
  const contextMessage = buildContextMessage({
    requestHints: ctx.requestHints,
    projectContext: ctx.projectContext,
  });
  const chatMessages = contextMessage
    ? [contextMessage, ...baseMessages]
    : baseMessages;

  // Resolve the most recent image in the conversation so the generateImage tool
  // can use it as an edit base when the model chooses to edit rather than create.
  const latestImageUrl = resolveLatestImageUrl(ctx.uiMessages);

  if (isGeminiSignatureDebugEnabled && isGoogleModel(model)) {
    console.info(
      "[gemini-signatures] model payload",
      JSON.stringify({
        chatId: ctx.chatId,
        model,
        messages: summarizeGoogleSignaturePayload(chatMessages),
      })
    );
  }

  const result = streamText({
    model: myProvider.languageModel(model),
    system: systemPrompt({ selectedChatModel: model }),
    messages: chatMessages,
    stopWhen: stepCountIs(stepLimit),
    ...(isReasoningModelId(model) &&
      isThinkingEnabled &&
      thinkingSetting?.type === "effort" &&
      !isAutoReasoning(thinkingSetting) && {
        reasoningEffort: thinkingSetting.value,
      }),
    providerOptions,
    prepareStep: ({ steps, stepNumber, messages }) => {
      // On the second-to-last step with no text yet, disable tools and nudge
      // the model toward a final answer.
      if (stepNumber >= stepLimit - 1) {
        const lastStep = steps.at(-1);
        const hasTextInLastStep =
          lastStep?.text && lastStep.text.trim().length > 0;

        if (!hasTextInLastStep) {
          messages.push({
            role: "assistant" as const,
            content: FINAL_ANSWER_REMINDER,
          });
          return { activeTools: [], messages };
        }
      }

      return {};
    },
    tools: {
      calculator,
      webSearch: webSearch({ session: ctx.session, chatId: ctx.chatId }),
      extractUrl: extractUrl({ session: ctx.session, chatId: ctx.chatId }),
      generateImage: generateImage({
        userId: ctx.userId,
        chatId: ctx.chatId,
        usageAccumulator: ctx.imageUsageAccumulator,
        latestImageUrl,
      }),
      generatePdf: generatePdf({
        userId: ctx.userId,
        chatId: ctx.chatId,
      }),
    },
    experimental_telemetry: {
      isEnabled: isProductionEnvironment,
      functionId: "stream-text",
    },
    onFinish: async ({ usage }) => {
      try {
        const catalog = await getTokenlensCatalog();
        const resolvedModelId = myProvider.languageModel(model).modelId;
        const merged = mergeUsage({
          usage,
          accumulator: ctx.imageUsageAccumulator,
          modelId: resolvedModelId,
          catalog,
        });
        ctx.lastUsage.value = merged;
        writer.write({ type: "data-usage", data: merged });

        console.info("------TOTAL USAGE", usageChargeUsd(merged));

        // Charge only when usage was priced (resolved model + catalog present).
        if (resolvedModelId && catalog) {
          await chargeUsageSafe({
            userId: ctx.userId,
            usdCost: usageChargeUsd(merged),
            modelId: resolvedModelId,
            chatId: ctx.chatId,
            description: "Chat completion",
          });
        } else {
          console.warn("[ALARM-USAGE]No resolvedModelId or catalog found", {
            resolvedModelId,
            catalog,
            usage,
          });
        }
      } catch (err) {
        console.warn("TokenLens enrichment failed", err);
        const merged = mergeUsage({
          usage,
          accumulator: ctx.imageUsageAccumulator,
          modelId: undefined,
          catalog: undefined,
        });
        ctx.lastUsage.value = merged;
        writer.write({ type: "data-usage", data: merged });
      }
    },
  });

  // Surface stream-level failures so they hit the logs (and Vercel error
  // tracking) instead of being silently swallowed — without this the function
  // can crash mid-generation with no trace.
  result.consumeStream({
    onError: (error) => {
      console.error("[chat-stream] consumeStream error", error);
    },
  });
  writer.merge(result.toUIMessageStream({ sendReasoning: true }));
}
