import { geolocation } from "@vercel/functions";
import { after } from "next/server";
import type { Session } from "next-auth";
import {
  DEFAULT_CHAT_MODEL,
  isReasoningModelId,
  isVisibleInUI,
  supportsAttachments,
  validateImageGenSetting,
  validateThinkingSetting,
} from "@/lib/ai/models";
import type { ProjectContextInput, RequestHints } from "@/lib/ai/prompts";
import { calculateOptimalStepLimit } from "@/lib/ai/step-calculator";
import { createImageUsageAccumulator } from "@/lib/ai/tools/generate-image";
import { hasPositiveBalance } from "@/lib/billing/balance";
import { createStreamId } from "@/lib/db/query/chat/create-stream-id";
import { getChatById } from "@/lib/db/query/chat/get-chat-by-id";
import { getMessagesByChatId } from "@/lib/db/query/chat/get-messages-by-chat-id";
import { saveChat } from "@/lib/db/query/chat/save-chat";
import { saveMessages } from "@/lib/db/query/chat/save-messages";
import { updateChatTitle } from "@/lib/db/query/chat/update-chat-title";
import { getProjectById } from "@/lib/db/query/project/get-project-by-id";
import { incrementProjectUsage } from "@/lib/db/query/project/increment-project-usage";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../../actions";
import type { PostRequestBody } from "../schema";
import type { ChatTurnContext } from "./context";

const PLACEHOLDER_TITLE_MAX_LENGTH = 80;

/**
 * Strip reasoning parts from historical assistant messages to prevent
 * cross-provider incompatibilities (e.g. Anthropic reasoning sent to OpenAI).
 * Reasoning is ephemeral display content — not needed for inference context.
 */
function sanitizeHistory(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => {
    if (message.role !== "assistant" || !message.parts) {
      return message;
    }

    const filteredParts = message.parts.filter((p) => p.type !== "reasoning");

    // Keep the original message if filtering would remove all meaningful parts.
    if (
      filteredParts.length === 0 ||
      !filteredParts.some((p) => p.type === "text")
    ) {
      return message;
    }

    return filteredParts.length === message.parts.length
      ? message
      : { ...message, parts: filteredParts };
  });
}

/**
 * Authorize and set up one chat turn: normalize the model + settings, load the
 * chat/project/balance, save the chat (with background title) or verify
 * ownership, persist the user message, create the resumable stream id, and
 * build the sanitized message history.
 *
 * Throws ChatSDKError("forbidden:chat") when the chat belongs to another user.
 * The returned context carries `hasBalance`; the caller enforces the gate after
 * this resolves so the user message is already saved (no client-side 404).
 */
export async function prepareChatTurn(
  body: PostRequestBody,
  session: Session,
  request: Request
): Promise<ChatTurnContext> {
  const {
    id,
    message,
    selectedChatModel: requestedChatModel,
    thinkingSetting: rawThinkingSetting,
    imageGenSetting: rawImageGenSetting,
    selectedProjectId,
    webSearchEnabled = true,
  } = body;

  const userId = session.user.id;

  // Transform hidden models to the default visible model, then validate the
  // thinking/image settings against the resolved model's config.
  const model = isVisibleInUI(requestedChatModel)
    ? requestedChatModel
    : DEFAULT_CHAT_MODEL;
  const thinkingSetting = validateThinkingSetting(model, rawThinkingSetting);
  const imageGenSetting = validateImageGenSetting(model, rawImageGenSetting);

  // Reasoning-only models without attachments run without tools, which lowers
  // the step budget. These flags feed the step-limit calculation only.
  const toolsDisabled =
    isReasoningModelId(model) && !supportsAttachments(model);
  const stepLimit = calculateOptimalStepLimit({
    modelId: model,
    thinkingSetting,
    hasWebSearch: webSearchEnabled && !toolsDisabled,
    hasImageGeneration: !toolsDisabled,
  });

  // Independent pre-stream reads in parallel.
  const [hasBalance, existingChat, projectRow] = await Promise.all([
    hasPositiveBalance(userId),
    getChatById({ id }),
    selectedProjectId
      ? getProjectById({ id: selectedProjectId })
      : Promise.resolve(undefined),
  ]);

  const projectContext: ProjectContextInput | null =
    projectRow && projectRow.userId === userId
      ? { name: projectRow.name, contextEntries: projectRow.contextEntries }
      : null;

  if (existingChat) {
    if (existingChat.userId !== userId) {
      throw new ChatSDKError("forbidden:chat");
    }
  } else {
    // Save chat with a placeholder title; generate the AI title in background.
    const textPart = message.parts.find((p) => p.type === "text");
    const placeholderTitle =
      textPart?.type === "text"
        ? textPart.text.substring(0, PLACEHOLDER_TITLE_MAX_LENGTH)
        : "New Chat";

    await saveChat({ id, userId, title: placeholderTitle });

    after(async () => {
      try {
        const aiTitle = await generateTitleFromUserMessage({ message });
        await updateChatTitle({ chatId: id, title: aiTitle });
      } catch (error) {
        console.error("Background title generation failed:", error);
      }
    });
  }

  const { longitude, latitude, city, country } = geolocation(request);
  const requestHints: RequestHints = { longitude, latitude, city, country };

  // Independent data-prep writes/reads in parallel.
  const streamId = generateUUID();
  const [messagesFromDb] = await Promise.all([
    getMessagesByChatId({ id }),
    saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: "user",
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
          modelId: null,
        },
      ],
    }),
    createStreamId({ streamId, chatId: id }),
  ]);

  const uiMessages = sanitizeHistory([
    ...convertToUIMessages(messagesFromDb),
    message,
  ]);

  // Fire-and-forget usage increment for the active project, once per turn that
  // reaches the inference path.
  if (projectRow && projectRow.userId === userId) {
    const projectIdToIncrement = projectRow.id;
    after(async () => {
      try {
        await incrementProjectUsage({ id: projectIdToIncrement, userId });
      } catch (error) {
        console.error("Background project usage increment failed:", error);
      }
    });
  }

  return {
    session,
    userId,
    chatId: id,
    message,
    uiMessages,
    model,
    thinkingSetting,
    imageGenSetting,
    previousGenerationId: body.previousGenerationId,
    webSearchEnabled,
    stepLimit,
    requestHints,
    projectContext,
    imageUsageAccumulator: createImageUsageAccumulator(),
    lastUsage: {},
    hasBalance,
  };
}
