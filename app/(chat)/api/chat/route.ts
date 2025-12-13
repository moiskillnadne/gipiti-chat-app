import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";
import { unstable_cache as cache } from "next/cache";
import { after } from "next/server";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
import type { ModelCatalog } from "tokenlens/core";
import { fetchModels } from "tokenlens/fetch";
import { getUsage } from "tokenlens/helpers";
import { z } from "zod";
import { auth, type UserType } from "@/app/(auth)/auth";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import {
  DEFAULT_CHAT_MODEL,
  getProviderOptions,
  isReasoningModelId,
  isVisibleInUI,
  supportsAttachments,
  supportsThinkingConfig,
  type ThinkingSetting,
} from "@/lib/ai/models";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { checkTokenQuota, recordTokenUsage } from "@/lib/ai/token-quota";
import { createDocument } from "@/lib/ai/tools/create-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { webSearch } from "@/lib/ai/tools/web-search";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatLastContextById,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import type { AppUsage } from "@/lib/usage";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import {
  createImageUsageAccumulator,
  generateImage,
} from "../../../../lib/ai/tools/generate-image";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

const getTokenlensCatalog = cache(
  async (): Promise<ModelCatalog | undefined> => {
    try {
      return await fetchModels();
    } catch (err) {
      console.warn(
        "TokenLens: catalog fetch failed, using default catalog",
        err
      );
      return; // tokenlens helpers will fall back to defaultCatalog
    }
  },
  ["tokenlens-catalog"],
  { revalidate: 24 * 60 * 60 } // 24 hours
);

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes("REDIS_URL")) {
        console.log(
          " > Resumable streams are disabled due to missing REDIS_URL"
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const textLengthError = error.errors.find(
        (err) => err.path.includes("text") && err.code === "too_big"
      );

      if (textLengthError && textLengthError.code === "too_big") {
        const received =
          "received" in textLengthError ? textLengthError.received : "unknown";
        return Response.json(
          {
            code: "bad_request:api",
            message:
              "Your message is too long. Please reduce it to 3000 characters or less.",
            cause: `Current length: ${received} characters`,
          },
          { status: 400 }
        );
      }
    }

    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel: requestedChatModel,
      thinkingSetting,
    } = requestBody;

    // Transform hidden models to default visible model
    const selectedChatModel = isVisibleInUI(requestedChatModel)
      ? requestedChatModel
      : DEFAULT_CHAT_MODEL;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    // Check token quota first
    const quotaCheck = await checkTokenQuota(session.user.id);

    if (!quotaCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: "quota_exceeded",
          message: quotaCheck.reason,
          quota: quotaCheck.quotaInfo,
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError("rate_limit:chat").toResponse();
    }

    const chat = await getChatById({ id });

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError("forbidden:chat").toResponse();
      }
    } else {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
      });
    }

    const messagesFromDb = await getMessagesByChatId({ id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: "user",
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    let finalMergedUsage: AppUsage | undefined;
    const imageUsageAccumulator = createImageUsageAccumulator();

    const providerOptions = getProviderOptions(selectedChatModel, thinkingSetting);

    const isThinkingEnabled =
      supportsThinkingConfig(selectedChatModel) &&
      thinkingSetting &&
      !(thinkingSetting.type === "effort" && thinkingSetting.value === "none") &&
      !(thinkingSetting.type === "budget" && thinkingSetting.value === 0);

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel, requestHints }),
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          ...(isReasoningModelId(selectedChatModel) &&
            isThinkingEnabled &&
            thinkingSetting?.type === "effort" && {
              reasoningEffort: thinkingSetting.value,
            }),
          providerOptions,
          experimental_activeTools:
            isReasoningModelId(selectedChatModel) &&
            !supportsAttachments(selectedChatModel)
              ? []
              : [
                  "getWeather",
                  "createDocument",
                  "updateDocument",
                  "requestSuggestions",
                  "webSearch",
                  "generateImage",
                ],
          experimental_transform: smoothStream({ chunking: "word" }),
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
            webSearch: webSearch({ session, chatId: id }),
            generateImage: generateImage({
              dataStream,
              userId: session.user.id,
              chatId: id,
              usageAccumulator: imageUsageAccumulator,
            }),
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
          onFinish: async ({ usage }) => {
            try {
              const providers = await getTokenlensCatalog();
              const modelId =
                myProvider.languageModel(selectedChatModel).modelId;
              if (!modelId) {
                finalMergedUsage = {
                  ...usage,
                  inputTokens:
                    (usage.inputTokens ?? 0) +
                    imageUsageAccumulator.totalInputTokens,
                  outputTokens:
                    (usage.outputTokens ?? 0) +
                    imageUsageAccumulator.totalOutputTokens,
                };
                dataStream.write({
                  type: "data-usage",
                  data: finalMergedUsage,
                });
                return;
              }

              if (!providers) {
                finalMergedUsage = {
                  ...usage,
                  inputTokens:
                    (usage.inputTokens ?? 0) +
                    imageUsageAccumulator.totalInputTokens,
                  outputTokens:
                    (usage.outputTokens ?? 0) +
                    imageUsageAccumulator.totalOutputTokens,
                };
                dataStream.write({
                  type: "data-usage",
                  data: finalMergedUsage,
                });
                return;
              }

              const summary = getUsage({ modelId, usage, providers });
              const baseCost =
                ((summary as AppUsage).inputCost ?? 0) +
                ((summary as AppUsage).outputCost ?? 0);
              finalMergedUsage = {
                ...usage,
                ...summary,
                modelId,
                inputTokens:
                  (usage.inputTokens ?? 0) +
                  imageUsageAccumulator.totalInputTokens,
                outputTokens:
                  (usage.outputTokens ?? 0) +
                  imageUsageAccumulator.totalOutputTokens,
                inputCost: baseCost + imageUsageAccumulator.totalCost,
              } as AppUsage;
              dataStream.write({ type: "data-usage", data: finalMergedUsage });

              // Record token usage for quota tracking
              try {
                await recordTokenUsage({
                  userId: session.user.id,
                  chatId: id,
                  messageId: undefined, // Will be set in outer onFinish
                  usage: finalMergedUsage,
                });
              } catch (err) {
                console.warn("Failed to record token usage", err);
              }
            } catch (err) {
              console.warn("TokenLens enrichment failed", err);
              finalMergedUsage = {
                ...usage,
                inputTokens:
                  (usage.inputTokens ?? 0) +
                  imageUsageAccumulator.totalInputTokens,
                outputTokens:
                  (usage.outputTokens ?? 0) +
                  imageUsageAccumulator.totalOutputTokens,
              };
              dataStream.write({ type: "data-usage", data: finalMergedUsage });
            }
          },
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          })
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        await saveMessages({
          messages: messages.map((currentMessage) => ({
            id: currentMessage.id,
            role: currentMessage.role,
            parts: currentMessage.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
          })),
        });

        if (finalMergedUsage) {
          try {
            await updateChatLastContextById({
              chatId: id,
              context: finalMergedUsage,
            });
          } catch (err) {
            console.warn("Unable to persist last usage for chat", id, err);
          }
        }
      },
      onError: () => {
        return "Oops, an error occurred!";
      },
    });

    return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // Check for Vercel AI Gateway credit card error
    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatSDKError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatSDKError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
