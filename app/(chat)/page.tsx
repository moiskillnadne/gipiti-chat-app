import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import {
  chatModelIds,
  DEFAULT_CHAT_MODEL,
  isVisibleInUI,
} from "@/lib/ai/models";
import { generateUUID } from "@/lib/utils";
import { auth } from "../(auth)/auth";
import { saveChatModelAsCookie } from "./actions";

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const id = generateUUID();

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get("chat-model");

  // Validate cookie value and fall back to default if invalid or hidden from UI
  let validatedModelId = DEFAULT_CHAT_MODEL;

  if (
    modelIdFromCookie?.value &&
    chatModelIds.includes(modelIdFromCookie.value)
  ) {
    // Check if model is visible in UI, otherwise fall back to default
    if (isVisibleInUI(modelIdFromCookie.value)) {
      validatedModelId = modelIdFromCookie.value;
    } else {
      // Update cookie with fallback model
      await saveChatModelAsCookie(DEFAULT_CHAT_MODEL);
    }
  }

  return (
    <>
      <Chat
        autoResume={false}
        id={id}
        initialChatModel={validatedModelId}
        initialMessages={[]}
        isReadonly={false}
        key={id}
      />
      <DataStreamHandler />
    </>
  );
}
