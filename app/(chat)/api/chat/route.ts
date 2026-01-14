import { put } from "@vercel/blob";
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
import OpenAI from "openai";
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
import { ensureMessageHasTextPart } from "@/lib/ai/message-validator";
import {
  DEFAULT_CHAT_MODEL,
  getModelById,
  getProviderOptions,
  isImageGenerationModel,
  isReasoningModelId,
  isVisibleInUI,
  supportsAttachments,
  supportsThinkingConfig,
} from "@/lib/ai/models";
import {
  downloadImageAsFile,
  generateImageGenerationId,
  isDirectOpenAIModel,
  openaiClient,
} from "@/lib/ai/openai-client";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { calculateOptimalStepLimit } from "@/lib/ai/step-calculator";
import { checkTokenQuota, recordTokenUsage } from "@/lib/ai/token-quota";
import { calculator } from "@/lib/ai/tools/calculator";
import { createDocument } from "@/lib/ai/tools/create-document";
import { extractUrl } from "@/lib/ai/tools/extract-url";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { webSearch } from "@/lib/ai/tools/web-search";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getActiveUserSubscription,
  getChatById,
  getDocumentById,
  getMessageCountByUserId,
  getMessagesByChatId,
  insertImageGenerationUsageLog,
  saveChat,
  saveDocument,
  saveMessages,
  updateChatLastContextById,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import {
  createImageUsageAccumulator,
  generateImage,
} from "../../../../lib/ai/tools/generate-image";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 300;

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

// Direct image generation utility
async function uploadGeneratedImage(
  base64Data: string,
  mediaType: string
): Promise<string> {
  const buffer = Buffer.from(base64Data, "base64");
  const extension = mediaType.split("/").at(1) ?? "png";
  const filename = `generated-${generateUUID()}.${extension}`;

  const { url } = await put(filename, buffer, { access: "public" });
  return url;
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
      previousGenerationId,
    } = requestBody;

    console.log("previousGenerationId", previousGenerationId);

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
      return new ChatSDKError(
        "quota_exceeded:chat",
        JSON.stringify(quotaCheck.quotaInfo), // Pass quota info as cause
        quotaCheck.reason
      ).toResponse();
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
      const t0 = performance.now();
      const title = await generateTitleFromUserMessage({
        message,
      });
      const t1 = performance.now();
      console.log("Time taken to generate title:", t1 - t0, "milliseconds");

      console.log("title", title);

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

    const providerOptions = getProviderOptions(
      selectedChatModel,
      thinkingSetting
    );

    const isThinkingEnabled =
      supportsThinkingConfig(selectedChatModel) &&
      thinkingSetting &&
      !(
        thinkingSetting.type === "effort" && thinkingSetting.value === "none"
      ) &&
      !(thinkingSetting.type === "budget" && thinkingSetting.value === 0);

    const hasWebSearchTool =
      !(
        isReasoningModelId(selectedChatModel) &&
        !supportsAttachments(selectedChatModel)
      ) && ["webSearch"].length > 0;
    const hasImageGenerationTool =
      !(
        isReasoningModelId(selectedChatModel) &&
        !supportsAttachments(selectedChatModel)
      ) && ["generateImage"].length > 0;

    const optimalStepLimit = calculateOptimalStepLimit({
      modelId: selectedChatModel,
      thinkingSetting,
      hasWebSearch: hasWebSearchTool,
      hasImageGeneration: hasImageGenerationTool,
    });

    console.info("optimalStepLimit", optimalStepLimit);

    // Check if this is a direct image generation model
    const isDirectImageGeneration = isImageGenerationModel(selectedChatModel);

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        if (isDirectImageGeneration) {
          // Direct image generation with full tool-like behavior
          const userMessageParts = message.parts;
          const userPrompt =
            userMessageParts.find((part) => part.type === "text")?.text ?? null;

          if (!userPrompt) {
            throw new ChatSDKError("bad_request:api");
          }

          // Check if this is an edit request
          let previousImageUrl: string | undefined;

          if (
            !!requestBody.previousGenerationId &&
            isDirectOpenAIModel(selectedChatModel)
          ) {
            // Fetch the previous document
            try {
              const previousDoc = await getDocumentById({
                id: requestBody.previousGenerationId,
              });

              if (previousDoc.content) {
                previousImageUrl = previousDoc.content;
                console.log(
                  "Found previous image for editing:",
                  previousImageUrl
                );
              } else {
                console.warn(
                  "Previous document not found, generating new image"
                );
              }
            } catch (error) {
              console.error("Error fetching previous document:", error);
              // Fall back to new generation if we can't find the previous image
            }
          }

          // Initialize tracking variables
          const documentId = generateUUID();
          let imageUrl: string | undefined;
          let usageMetadata:
            | {
                promptTokenCount?: number;
                candidatesTokenCount?: number;
                thoughtsTokenCount?: number;
                totalTokenCount?: number;
              }
            | undefined;
          let totalCostUsd: string | undefined;
          // ResponseId for future multi-turn editing support
          let _responseId: string | undefined;

          // Write initial status
          dataStream.write({
            id: documentId,
            type: "reasoning-start",
          });

          // Check if this is gpt-image-1.5 (use direct OpenAI SDK)
          if (isDirectOpenAIModel(selectedChatModel)) {
            try {
              dataStream.write({
                id: documentId,
                type: "reasoning-delta",
                delta: previousImageUrl
                  ? "Editing image with OpenAI..."
                  : "Generating image with OpenAI...",
              });

              let openaiResponse: OpenAI.Images.ImagesResponse;

              if (previousImageUrl) {
                // EDIT MODE: Use images.edit() API
                const imageFile = await downloadImageAsFile(previousImageUrl);

                openaiResponse = await openaiClient.images.edit({
                  model: "gpt-image-1",
                  image: imageFile,
                  prompt: userPrompt,
                  size: "1024x1024",
                  n: 1,
                });
              } else {
                // GENERATE MODE: Use images.generate() API
                openaiResponse = await openaiClient.images.generate({
                  model: "gpt-image-1.5",
                  prompt: userPrompt,
                  size: "1024x1024",
                  quality: "medium",
                  n: 1,
                });
              }

              dataStream.write({
                id: documentId,
                type: "reasoning-delta",
                delta: "Uploading image...",
              });

              const base64Data = openaiResponse.data?.[0]?.b64_json;
              if (base64Data) {
                imageUrl = await uploadGeneratedImage(base64Data, "image/png");
              }

              // Generate a unique ID for this generation/edit
              _responseId = generateImageGenerationId();

              // Track basic usage (OpenAI doesn't return token counts for images)
              usageMetadata = {
                promptTokenCount: 0,
                candidatesTokenCount: 0,
                thoughtsTokenCount: 0,
                totalTokenCount: 0,
              };
            } catch (error) {
              if (error instanceof OpenAI.APIError) {
                console.error("OpenAI API Error:", error);
                if (error.status === 400) {
                  throw new ChatSDKError("bad_request:api");
                }
                if (error.status === 429) {
                  throw new ChatSDKError("rate_limit:chat");
                }
              }
              throw error;
            }
          } else {
            // Use existing gateway flow for other image generation models
            const messagesPayloadForImageGeneration =
              convertToModelMessages(uiMessages);

            console.dir(messagesPayloadForImageGeneration, { depth: null });

            // Start streaming
            const result = streamText({
              model: myProvider.languageModel(selectedChatModel),
              messages: messagesPayloadForImageGeneration,
              providerOptions: getModelById(selectedChatModel)?.providerOptions,
            });

            // Process stream manually
            for await (const delta of result.fullStream) {
              console.log("delta", delta);

              if (delta.type === "reasoning-delta") {
                dataStream.write({
                  id: documentId,
                  type: "reasoning-delta",
                  delta: delta.text,
                });
              }

              if (delta.type === "file") {
                dataStream.write({
                  id: documentId,
                  type: "reasoning-delta",
                  delta: "Uploading image...",
                });

                const file = delta.file as {
                  base64Data?: string;
                  mediaType: string;
                };
                if (file.base64Data) {
                  imageUrl = await uploadGeneratedImage(
                    file.base64Data,
                    file.mediaType
                  );
                }
              }

              if (delta.type === "finish-step") {
                const metadata = await result.providerMetadata;
                if (metadata) {
                  usageMetadata = metadata.google
                    ?.usageMetadata as typeof usageMetadata;
                  totalCostUsd = metadata.gateway?.cost?.toString();

                  // Debug: log full metadata structure
                  console.log(
                    "Full metadata:",
                    JSON.stringify(metadata, null, 2)
                  );

                  // Extract responseId for multi-turn editing
                  // Try different possible locations
                  const genId =
                    (typeof metadata.google?.generationId === "string"
                      ? metadata.google.generationId
                      : null) ??
                    (typeof metadata.gateway?.generationId === "string"
                      ? metadata.gateway.generationId
                      : null) ??
                    (typeof metadata.generationId === "string"
                      ? metadata.generationId
                      : null) ??
                    null;

                  console.log("Extracted generationId:", genId);

                  if (genId) {
                    _responseId = genId;
                  }
                }
              }
            }
          }

          // Write final image generation result (non-transient so it persists)
          if (imageUrl) {
            dataStream.write({
              type: "data-imageGenerationFinish",
              data: {
                responseId: _responseId,
                imageUrl,
                userPrompt,
                usageMetadata,
                documentId,
              },
            });

            dataStream.write({
              type: "file",
              mediaType: "image/png",
              url: imageUrl,
            });
          }

          // Save document to database
          if (imageUrl) {
            await saveDocument({
              id: documentId,
              title: userPrompt,
              content: imageUrl,
              kind: "image",
              userId: session.user.id,
              generationId: _responseId ?? generateImageGenerationId(),
            });
          }

          // Update accumulator for merged usage tracking
          if (usageMetadata) {
            const inputTokens = usageMetadata.promptTokenCount ?? 0;
            const outputTokens =
              (usageMetadata.candidatesTokenCount ?? 0) +
              (usageMetadata.thoughtsTokenCount ?? 0);
            const cost = totalCostUsd ? Number.parseFloat(totalCostUsd) : 0;

            imageUsageAccumulator.totalInputTokens += inputTokens;
            imageUsageAccumulator.totalOutputTokens += outputTokens;
            imageUsageAccumulator.totalCost += cost;
            imageUsageAccumulator.generationCount += 1;
          }

          // Record usage to ImageGenerationUsageLog
          try {
            const subscription = await getActiveUserSubscription({
              userId: session.user.id,
            });

            let billingPeriodStart: Date;
            let billingPeriodEnd: Date;
            let billingPeriodType: "daily" | "weekly" | "monthly" | "annual";

            if (subscription) {
              billingPeriodStart = subscription.currentPeriodStart;
              billingPeriodEnd = subscription.currentPeriodEnd;
              billingPeriodType = subscription.billingPeriod;
            } else {
              // Tester plan: use daily period
              const now = new Date();
              billingPeriodStart = new Date(now);
              billingPeriodStart.setHours(0, 0, 0, 0);
              billingPeriodEnd = new Date(now);
              billingPeriodEnd.setHours(23, 59, 59, 999);
              billingPeriodType = "daily";
            }

            await insertImageGenerationUsageLog({
              userId: session.user.id,
              chatId: id,
              modelId: selectedChatModel,
              prompt: userPrompt,
              imageUrl: imageUrl ?? null,
              generationId: _responseId ?? null,
              success: Boolean(imageUrl),
              promptTokens: usageMetadata?.promptTokenCount ?? 0,
              candidatesTokens: usageMetadata?.candidatesTokenCount ?? 0,
              thoughtsTokens: usageMetadata?.thoughtsTokenCount ?? 0,
              totalTokens: usageMetadata?.totalTokenCount ?? 0,
              totalCostUsd: totalCostUsd ?? null,
              billingPeriodType,
              billingPeriodStart,
              billingPeriodEnd,
            });
          } catch (err) {
            console.warn("Failed to record image generation usage", err);
          }

          // Record token usage for quota tracking
          if (usageMetadata) {
            const inputTokens = usageMetadata.promptTokenCount ?? 0;
            const outputTokens =
              (usageMetadata.candidatesTokenCount ?? 0) +
              (usageMetadata.thoughtsTokenCount ?? 0);
            const directImageUsage: AppUsage = {
              modelId: selectedChatModel,
              inputTokens,
              outputTokens,
              totalTokens: inputTokens + outputTokens,
              inputCost: totalCostUsd ? Number.parseFloat(totalCostUsd) : 0,
              outputCost: 0,
            };

            try {
              await recordTokenUsage({
                userId: session.user.id,
                chatId: id,
                messageId: undefined,
                usage: directImageUsage,
              });
            } catch (err) {
              console.warn(
                "Failed to record token usage for direct image generation",
                err
              );
            }
          }

          return;
        }

        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel, requestHints }),
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(optimalStepLimit),
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
                  "calculator",
                  "getWeather",
                  "createDocument",
                  "updateDocument",
                  "requestSuggestions",
                  "webSearch",
                  "extractUrl",
                  "generateImage",
                ],
          experimental_transform: smoothStream({ chunking: "word" }),
          prepareStep: ({ steps, stepNumber, messages }) => {
            // On second-to-last step, disable tools and add completion reminder
            if (stepNumber >= optimalStepLimit - 1) {
              const lastStep = steps.at(-1);
              const hasTextInLastStep =
                lastStep?.text && lastStep.text.trim().length > 0;

              // If no text yet, add a reminder and disable tools
              if (!hasTextInLastStep) {
                messages.push({
                  role: "assistant" as const,
                  content:
                    "Please provide your final answer now based on the information you've gathered. Do not call any more tools.",
                });

                return {
                  activeTools: [], // Disable all tools
                  messages,
                };
              }
            }

            return {};
          },
          tools: {
            calculator,
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
            webSearch: webSearch({ session, chatId: id }),
            extractUrl: extractUrl({ session, chatId: id }),
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
              dataStream.write({
                type: "data-usage",
                data: finalMergedUsage,
              });

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
              dataStream.write({
                type: "data-usage",
                data: finalMergedUsage,
              });
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
        // Validate and fix messages before saving (ensure text parts exist)
        const validatedMessages = messages.map((msg) => {
          if (msg.role === "assistant") {
            return ensureMessageHasTextPart(msg as ChatMessage, {
              modelId: selectedChatModel,
              stepCount: messages.length,
              stepLimit: optimalStepLimit,
            });
          }
          return msg;
        });

        await saveMessages({
          messages: validatedMessages.map((currentMessage) => ({
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
