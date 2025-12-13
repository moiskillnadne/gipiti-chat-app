import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import {
  chatModelIds,
  DEFAULT_CHAT_MODEL,
  DEFAULT_THINKING_EFFORT,
  isVisibleInUI,
  THINKING_EFFORTS,
  type ThinkingEffort,
} from "@/lib/ai/models";
import { generateUUID } from "@/lib/utils";
import { auth } from "../(auth)/auth";

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const id = generateUUID();

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get("chat-model");
  const thinkingEffortFromCookie = cookieStore.get("thinking-effort");

  // Validate cookie value and fall back to default if invalid or hidden from UI
  const validatedModelId =
    modelIdFromCookie?.value &&
    chatModelIds.includes(modelIdFromCookie.value) &&
    isVisibleInUI(modelIdFromCookie.value)
      ? modelIdFromCookie.value
      : DEFAULT_CHAT_MODEL;

  const validatedThinkingEffort: ThinkingEffort =
    thinkingEffortFromCookie?.value &&
    THINKING_EFFORTS.includes(thinkingEffortFromCookie.value as ThinkingEffort)
      ? (thinkingEffortFromCookie.value as ThinkingEffort)
      : DEFAULT_THINKING_EFFORT;

  return (
    <>
      <Chat
        autoResume={false}
        id={id}
        initialChatModel={validatedModelId}
        initialMessages={[]}
        initialThinkingEffort={validatedThinkingEffort}
        isReadonly={false}
        key={id}
      />
      <DataStreamHandler />
    </>
  );
}
