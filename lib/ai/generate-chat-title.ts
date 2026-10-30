import type { GatewayProviderOptions } from "@ai-sdk/gateway";
import { generateText, type UIMessage } from "ai";
import { myProvider } from "@/lib/ai/providers";

// Server-only helper, deliberately not a server action: a "use server" export
// would let any client call the title model at our cost.
export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const { text: title } = await generateText({
    model: myProvider.languageModel("title-model"),
    system: `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons
    - IMPORTANT: Generate the title in the same language as the user's message`,
    prompt: JSON.stringify(message),
    providerOptions: {
      gateway: {
        models: ["openai/gpt-5.4-nano", "anthropic/claude-haiku-4.5"],
      } satisfies GatewayProviderOptions,
    },
  });

  return title;
}
