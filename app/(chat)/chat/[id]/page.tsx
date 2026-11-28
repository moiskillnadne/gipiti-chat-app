import { notFound, redirect } from "next/navigation";
import { Chat } from "@/components/chat";
import { isValidUUID } from "@/lib/utils";
import { auth } from "@/server/modules/auth/next-auth";
import { getChatById } from "@/server/modules/chat/queries/get-chat-by-id";
import { getMessagesByChatId } from "@/server/modules/chat/queries/get-messages-by-chat-id";
import { convertToUIMessages } from "@/server/modules/chat/to-ui-messages";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;

  if (!isValidUUID(id)) {
    return notFound();
  }

  const chat = await getChatById({ id });

  if (!chat) {
    return notFound();
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

  return (
    <Chat
      autoResume={true}
      id={chat.id}
      initialLastContext={chat.lastContext ?? undefined}
      initialMessages={uiMessages}
      isReadonly={session?.user?.id !== chat.userId}
    />
  );
}
