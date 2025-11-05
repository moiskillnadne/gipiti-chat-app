import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { chatModelIds, DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
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

  // Validate cookie value and fall back to default if invalid
  let validatedModelId = DEFAULT_CHAT_MODEL;

  if (modelIdFromCookie?.value && chatModelIds.includes(modelIdFromCookie.value)) {
    validatedModelId = modelIdFromCookie.value;
  }

  return (
    <>
      <Chat
        autoResume={false}
        id={id}
        initialChatModel={validatedModelId}
        initialMessages={[]}
        initialVisibilityType="private"
        isReadonly={false}
        key={id}
      />
      <DataStreamHandler />
    </>
  );
}
