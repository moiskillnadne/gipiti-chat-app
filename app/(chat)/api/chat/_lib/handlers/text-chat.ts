import type { SharedV2ProviderOptions } from "@ai-sdk/provider";
import {
  convertToModelMessages,
  type ModelMessage,
  stepCountIs,
  streamText,
} from "ai";
import { attachDocxContentForModel } from "@/lib/ai/docx-extract";
import {
  getProviderOptions,
  isAutoReasoning,
  isGoogleModel,
  isReasoningModelId,
  supportsMcp,
  supportsThinkingConfig,
  supportsToolCalling,
} from "@/lib/ai/models";
import { buildContextMessage, systemPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { resolveLatestImageUrl } from "@/lib/ai/resolve-latest-image";
import { attachTextContentForModel } from "@/lib/ai/text-attachments";
import { calculator } from "@/lib/ai/tools/calculator";
import { extractUrl } from "@/lib/ai/tools/extract-url";
import { generateCsv } from "@/lib/ai/tools/generate-csv";
import { generateDocx } from "@/lib/ai/tools/generate-docx";
import { generateImage } from "@/lib/ai/tools/generate-image";
import { generateMarkdown } from "@/lib/ai/tools/generate-markdown";
import { generatePdf } from "@/lib/ai/tools/generate-pdf";
import { generateTxt } from "@/lib/ai/tools/generate-txt";
import { webSearch } from "@/lib/ai/tools/web-search";
import {
  isGeminiSignatureDebugEnabled,
  isProductionEnvironment,
} from "@/lib/constants";
import {
  compactMcpHistory,
  flattenOrphans,
  hasMcpParts,
} from "@/lib/integrations/history";
import { buildIntegrationTurnPlan } from "@/lib/integrations/turn-plan";
import type { AppUsage } from "@/lib/usage";
import { chargeUsageSafe } from "../charge";
import type { ChatTurnContext, StreamWriter } from "../context";
import {
  closeStreamOnForcedAbort,
  createTurnLifecycle,
} from "../turn-lifecycle";
import {
  computeAbortedTurnUsage,
  computeErroredTurnUsage,
  createInFlightStepTracker,
  getTokenlensCatalog,
  mergeUsage,
  sumGatewayCostUsd,
  usageChargeUsd,
} from "../usage";

/** Extra steps granted to a turn that carries integration (MCP) tools. */
const MCP_EXTRA_STEPS = 3;

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
 * Flatten the text the model was sent (system prompt + message text, tool
 * calls and results as JSON; files are skipped) so a stop during the first step
 * can estimate that step's input tokens.
 */
function extractPromptText(system: string, messages: ModelMessage[]): string {
  const chunks = [system];
  for (const { content } of messages) {
    if (typeof content === "string") {
      chunks.push(content);
      continue;
    }
    for (const part of content) {
      if (part.type === "text" || part.type === "reasoning") {
        chunks.push(part.text);
      } else if (part.type === "tool-call") {
        chunks.push(JSON.stringify(part.input) ?? "");
      } else if (part.type === "tool-result") {
        chunks.push(JSON.stringify(part.output) ?? "");
      }
    }
  }
  return chunks.join("\n");
}

/**
 * Close the integration clients exactly once, from whichever terminal path
 * fires first: finish, stream end, forced abort, or the function-deadline timer.
 */
function createPlanCloser(
  closePlan: () => Promise<void>,
  ctx: ChatTurnContext
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const close = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    closePlan().catch((error) => {
      console.warn("[integrations] close failed", {
        chatId: ctx.chatId,
        code: error instanceof Error ? error.name : "unknown",
      });
    });
  };
  if (ctx.deadlineAt !== undefined) {
    timer = setTimeout(close, Math.max(0, ctx.deadlineAt - Date.now()));
    timer.unref?.();
  }
  ctx.turnAbort.onForcedAbort(close);
  return close;
}

/**
 * Run a standard text-chat turn via streamText: build the system prompt, expose
 * the tool set (gated by model capability + web-search toggle), stream the
 * reply, and on finish enrich usage via TokenLens and charge the cost. The
 * merged usage is stashed on ctx for last-context persistence.
 *
 * When the user stops the turn (`ctx.turnAbort`), the provider request is
 * aborted and the turn is settled once by the turn lifecycle: finished steps are
 * charged at their real cost plus an estimate for the step that was running.
 * A stream that fails without a stop is settled the same way, once, but only
 * the finished steps (and image-tool cost already spent) are charged.
 * `ctx.turnSettlement` resolves on every terminal path (the SDK does not await
 * `onAbort`); the route awaits it before persisting the message.
 */
export async function runTextChat(
  ctx: ChatTurnContext,
  writer: StreamWriter
): Promise<void> {
  try {
    await streamTextTurn(ctx, writer);
  } catch (error) {
    // Nothing will bill this turn: do not leave the route waiting for it.
    ctx.turnSettlement.resolve();
    throw error;
  }
}

async function streamTextTurn(
  ctx: ChatTurnContext,
  writer: StreamWriter
): Promise<void> {
  const { model, thinkingSetting } = ctx;

  // Integration tools are built (not connected) up front: connecting is lazy
  // and happens on the first tool call.
  const plan =
    ctx.integrationConnections.length > 0 && supportsToolCalling(model)
      ? buildIntegrationTurnPlan({
          connections: ctx.integrationConnections,
          turnSignal: ctx.turnAbort.signal,
          stopRequested: ctx.turnAbort.stopRequested,
        })
      : undefined;
  const planTools = plan?.tools ?? {};
  const hasPlanTools = Object.keys(planTools).length > 0;
  const stepLimit = hasPlanTools
    ? ctx.stepLimit + MCP_EXTRA_STEPS
    : ctx.stepLimit;
  const historyHasMcp = hasMcpParts(ctx.uiMessages);
  // MCP results are user data: keep them out of spans and error logs.
  const isMcpTurn = hasPlanTools || historyHasMcp;

  const providerOptions = getProviderOptions(model, thinkingSetting);

  const isThinkingEnabled =
    supportsThinkingConfig(model) &&
    thinkingSetting &&
    !(thinkingSetting.type === "effort" && thinkingSetting.value === "none") &&
    !(thinkingSetting.type === "budget" && thinkingSetting.value === 0);

  // Static system prompt + dynamic context as a leading message keeps the
  // system block byte-identical across users so the Gateway cache prefix is
  // shared. Per-user data (geolocation, project) lives below the cache line.
  // Replace uploaded .docx and text (.md/.txt/code) attachments with their
  // extracted text so the model can read them (providers only accept images and
  // PDFs as file parts). The stored user message keeps its file part, so the UI
  // still shows the attachment chip.
  const historyForModel = historyHasMcp
    ? [
        ...compactMcpHistory(
          flattenOrphans(ctx.uiMessages, {
            activeToolNames: new Set(Object.keys(planTools)),
            modelSupportsMcp: hasPlanTools && supportsMcp(model),
          })
        ),
      ]
    : ctx.uiMessages;
  const messagesForModel = await attachTextContentForModel(
    await attachDocxContentForModel(historyForModel)
  );
  // A message the user stopped mid tool call must not replay the dangling call.
  const baseMessages = (
    await convertToModelMessages(messagesForModel, {
      ignoreIncompleteToolCalls: true,
    })
  ).filter((message) => !isEmptyAssistantMessage(message));
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

  // Models without function calling (Perplexity Sonar — search is built into
  // the model and tool definitions are rejected) run without the app tool set.
  const chatTools = supportsToolCalling(model)
    ? {
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
        generateDocx: generateDocx({
          userId: ctx.userId,
          chatId: ctx.chatId,
        }),
        generateMarkdown: generateMarkdown({
          userId: ctx.userId,
          chatId: ctx.chatId,
        }),
        generateTxt: generateTxt({
          userId: ctx.userId,
          chatId: ctx.chatId,
        }),
        generateCsv: generateCsv({
          userId: ctx.userId,
          chatId: ctx.chatId,
        }),
      }
    : undefined;

  // The user stopped before any request was made (e.g. during the preparation
  // above): there is nothing to abort and nothing to bill.
  if (ctx.turnAbort.signal.aborted) {
    ctx.turnOutcome = "skipped";
    ctx.turnSettlement.resolve();
    return;
  }

  const closePlan = plan ? createPlanCloser(plan.close, ctx) : undefined;

  const system = systemPrompt({ selectedChatModel: model });
  const tracker = createInFlightStepTracker();
  const resolvedModelId = myProvider.languageModel(model).modelId;

  /** Charge a turn settled by the stop or error path; returns the USD charged. */
  const chargeSettledTurn = async (
    merged: AppUsage,
    description: string
  ): Promise<number> => {
    ctx.lastUsage.value = merged;
    const chargeUsd = usageChargeUsd(merged);
    if (chargeUsd > 0) {
      await chargeUsageSafe({
        userId: ctx.userId,
        usdCost: chargeUsd,
        modelId: resolvedModelId,
        chatId: ctx.chatId,
        description,
      });
    }
    return chargeUsd;
  };

  const lifecycle = createTurnLifecycle({
    turnAbort: ctx.turnAbort,
    tracker,
    settlement: ctx.turnSettlement,
    onOutcome: (outcome) => {
      ctx.turnOutcome = outcome;
    },
    billAborted: async ({ steps, inFlightOutputText, atStepBoundary }) => {
      const catalog = await getTokenlensCatalog();
      const merged = computeAbortedTurnUsage({
        steps,
        inFlightOutputText,
        promptText: extractPromptText(system, chatMessages),
        atStepBoundary,
        accumulator: ctx.imageUsageAccumulator,
        modelId: resolvedModelId,
        catalog,
      });
      const chargeUsd = await chargeSettledTurn(
        merged,
        "Chat completion (stopped)"
      );
      console.info("[chat-stop] aborted turn charged", {
        chatId: ctx.chatId,
        usd: chargeUsd,
        steps: steps.length,
      });
    },
    billErrored: async ({ steps }) => {
      // Failed on the first request, before any tool ran: nothing was spent.
      if (steps.length === 0 && ctx.imageUsageAccumulator.totalCost === 0) {
        return;
      }
      const catalog = await getTokenlensCatalog();
      const merged = computeErroredTurnUsage({
        steps,
        accumulator: ctx.imageUsageAccumulator,
        modelId: resolvedModelId,
        catalog,
      });
      const chargeUsd = await chargeSettledTurn(
        merged,
        "Chat completion (error)"
      );
      console.info("[chat-stream] errored turn charged", {
        chatId: ctx.chatId,
        usd: chargeUsd,
        steps: steps.length,
      });
    },
  });

  const result = streamText({
    model: myProvider.languageModel(model),
    system,
    messages: chatMessages,
    abortSignal: ctx.turnAbort.signal,
    ...lifecycle.callbacks,
    onError: ({ error }) => {
      if (isMcpTurn) {
        console.error("[chat-stream] mcp turn error", {
          chatId: ctx.chatId,
          code: error instanceof Error ? error.name : "unknown",
        });
      } else {
        console.error(error);
      }
      lifecycle.onStreamError();
    },
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
    tools: chatTools && { ...chatTools, ...planTools },
    experimental_telemetry: {
      isEnabled: isProductionEnvironment,
      functionId: "stream-text",
      ...(isMcpTurn && { recordInputs: false, recordOutputs: false }),
    },
    onFinish: async ({ usage, totalUsage, steps }) => {
      closePlan?.();
      // Stop path vs. normal charge is decided (and kept exclusive) by the
      // lifecycle.
      if (!lifecycle.beginFinish(totalUsage)) {
        return;
      }

      try {
        const catalog = await getTokenlensCatalog();
        const merged = mergeUsage({
          usage,
          accumulator: ctx.imageUsageAccumulator,
          modelId: resolvedModelId,
          catalog,
          gatewayCostUsd: sumGatewayCostUsd(steps),
        });
        ctx.lastUsage.value = merged;
        writer.write({ type: "data-usage", data: merged });

        const chargeUsd = usageChargeUsd(merged);
        console.info("------TOTAL USAGE", chargeUsd);

        // Charge whenever the turn was priced. The gateway cost alone is enough:
        // gating on the TokenLens catalog left every turn free on an instance
        // whose models.dev fetch failed. A $0 total is already logged by
        // mergeUsage / usageChargeUsd as [ALARM-USAGE].
        if (chargeUsd > 0) {
          await chargeUsageSafe({
            userId: ctx.userId,
            usdCost: chargeUsd,
            modelId: resolvedModelId,
            chatId: ctx.chatId,
            description: "Chat completion",
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
      } finally {
        lifecycle.completed();
      }
    },
  });

  // Surface stream-level failures so they hit the logs (and Vercel error
  // tracking) instead of being silently swallowed — without this the function
  // can crash mid-generation with no trace.
  Promise.resolve(
    result.consumeStream({
      onError: (error) => {
        // Provider errors can carry the request body (MCP results) — log the
        // name only on MCP turns, same as streamText.onError above.
        if (isMcpTurn) {
          console.error("[chat-stream] consumeStream error", {
            chatId: ctx.chatId,
            code: error instanceof Error ? error.name : "unknown",
          });
        } else {
          console.error("[chat-stream] consumeStream error", error);
        }
        lifecycle.onStreamError();
      },
    })
  )
    .finally(() => {
      closePlan?.();
      lifecycle.streamEnded();
    })
    .catch((error) => {
      console.warn("[chat-stream] stream settlement failed", error);
    });
  writer.merge(
    closeStreamOnForcedAbort(
      result.toUIMessageStream({ sendReasoning: true, sendSources: true }),
      ctx.turnAbort
    )
  );
}
