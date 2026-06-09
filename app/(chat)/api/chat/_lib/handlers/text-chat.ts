import { convertToModelMessages, stepCountIs, streamText } from "ai";
import {
  getProviderOptions,
  isAutoReasoning,
  isReasoningModelId,
  supportsThinkingConfig,
} from "@/lib/ai/models";
import { buildContextMessage, systemPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { calculator } from "@/lib/ai/tools/calculator";
import { extractUrl } from "@/lib/ai/tools/extract-url";
import { generateImage } from "@/lib/ai/tools/generate-image";
import { webSearch } from "@/lib/ai/tools/web-search";
import { isProductionEnvironment } from "@/lib/constants";
import { chargeUsageSafe } from "../charge";
import type { ChatTurnContext, StreamWriter } from "../context";
import { getTokenlensCatalog, mergeUsage, usageChargeUsd } from "../usage";

const FINAL_ANSWER_REMINDER =
  "Please provide your final answer now based on the information you've gathered. Do not call any more tools.";

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
  const baseMessages = await convertToModelMessages(ctx.uiMessages);
  const contextMessage = buildContextMessage({
    requestHints: ctx.requestHints,
    projectContext: ctx.projectContext,
  });
  const chatMessages = contextMessage
    ? [contextMessage, ...baseMessages]
    : baseMessages;

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

  result.consumeStream();
  writer.merge(result.toUIMessageStream({ sendReasoning: true }));
}
