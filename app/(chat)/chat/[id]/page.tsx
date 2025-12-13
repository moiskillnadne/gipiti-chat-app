import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import {
  chatModelIds,
  DEFAULT_CHAT_MODEL,
  DEFAULT_THINKING_EFFORT,
  isVisibleInUI,
  type ThinkingEffort,
  THINKING_EFFORTS,
} from "@/lib/ai/models";
import { getChatById, getMessagesByChatId } from "@/lib/db/queries";
import { convertToUIMessages } from "@/lib/utils";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  const chat = await getChatById({ id });

  if (!chat) {
    notFound();
  }

  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (!session.user) {
    return notFound();
  }

  if (session.user.id !== chat.userId) {
    return notFound();
  }

  const messagesFromDb = await getMessagesByChatId({
    id,
  });

  const uiMessages = convertToUIMessages(messagesFromDb);

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get("chat-model");
  const thinkingEffortFromCookie = cookieStore.get("thinking-effort");

  // Validate cookie value and fall back to default if invalid or hidden from UI
  const validatedModelId =
    chatModelFromCookie?.value &&
    chatModelIds.includes(chatModelFromCookie.value) &&
    isVisibleInUI(chatModelFromCookie.value)
      ? chatModelFromCookie.value
      : DEFAULT_CHAT_MODEL;

  const validatedThinkingEffort: ThinkingEffort =
    thinkingEffortFromCookie?.value &&
    THINKING_EFFORTS.includes(thinkingEffortFromCookie.value as ThinkingEffort)
      ? (thinkingEffortFromCookie.value as ThinkingEffort)
      : DEFAULT_THINKING_EFFORT;

  return (
    <>
      <Chat
        autoResume={true}
        id={chat.id}
        initialChatModel={validatedModelId}
        initialLastContext={chat.lastContext ?? undefined}
        initialMessages={uiMessages}
        initialThinkingEffort={validatedThinkingEffort}
        isReadonly={session?.user?.id !== chat.userId}
      />
      <DataStreamHandler />
    </>
  );
}
