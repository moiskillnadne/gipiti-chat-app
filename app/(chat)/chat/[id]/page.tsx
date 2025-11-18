import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { saveChatModelAsCookie } from "@/app/(chat)/actions";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import {
  chatModelIds,
  DEFAULT_CHAT_MODEL,
  isVisibleInUI,
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

  if (chat.visibility === "private") {
    if (!session.user) {
      return notFound();
    }

    if (session.user.id !== chat.userId) {
      return notFound();
    }
  }

  const messagesFromDb = await getMessagesByChatId({
    id,
  });

  const uiMessages = convertToUIMessages(messagesFromDb);

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get("chat-model");

  // Validate cookie value and fall back to default if invalid or hidden from UI
  let validatedModelId = DEFAULT_CHAT_MODEL;

  if (
    chatModelFromCookie?.value &&
    chatModelIds.includes(chatModelFromCookie.value)
  ) {
    // Check if model is visible in UI, otherwise fall back to default
    if (isVisibleInUI(chatModelFromCookie.value)) {
      validatedModelId = chatModelFromCookie.value;
    } else {
      // Update cookie with fallback model
      await saveChatModelAsCookie(DEFAULT_CHAT_MODEL);
    }
  }

  return (
    <>
      <Chat
        autoResume={true}
        id={chat.id}
        initialChatModel={validatedModelId}
        initialLastContext={chat.lastContext ?? undefined}
        initialMessages={uiMessages}
        initialVisibilityType={chat.visibility}
        isReadonly={session?.user?.id !== chat.userId}
      />
      <DataStreamHandler />
    </>
  );
}
