import type { ChatMessage } from "@/lib/types";

export type MessageValidationContext = {
  modelId: string;
  stepCount: number;
  stepLimit: number;
};

/**
 * Ensures assistant messages have a text part for display to users.
 *
 * When reasoning models hit step limits mid-reasoning, they may only generate
 * a reasoning part without a final text response. This validator detects that
 * case and synthesizes a minimal fallback response.
 *
 * The synthesized response directs users to the reasoning content above and
 * is marked with metadata for monitoring purposes.
 */
export const ensureMessageHasTextPart = (
  message: ChatMessage,
  context: MessageValidationContext
): ChatMessage => {
  // Only process assistant messages
  if (message.role !== "assistant") {
    return message;
  }

  const hasReasoningPart = message.parts.some((p) => p.type === "reasoning");
  const hasTextPart = message.parts.some(
    (p) => p.type === "text" && p.text && p.text.trim().length > 0
  );

  // If has reasoning but no text, synthesize fallback response
  if (hasReasoningPart && !hasTextPart) {
    console.warn(
      "[MESSAGE_VALIDATOR] Message missing text part after reasoning",
      {
        messageId: message.id,
        modelId: context.modelId,
        stepCount: context.stepCount,
        stepLimit: context.stepLimit,
        partTypes: message.parts.map((p) => p.type),
      }
    );

    // Add minimal text part directing user to reasoning content
    return {
      ...message,
      parts: [
        ...message.parts,
        {
          type: "text" as const,
          text: "Please see my detailed analysis above for the answer to your question.",
        },
      ],
    };
  }

  return message;
};
