import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import {
  chatModelIds,
  DEFAULT_CHAT_MODEL,
  getDefaultThinkingSetting,
  isVisibleInUI,
  parseThinkingSettingFromCookie,
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

  const validatedModelId =
    modelIdFromCookie?.value &&
    chatModelIds.includes(modelIdFromCookie.value) &&
    isVisibleInUI(modelIdFromCookie.value)
      ? modelIdFromCookie.value
      : DEFAULT_CHAT_MODEL;

  const thinkingCookieValue = cookieStore.get(
    `thinking-${validatedModelId}`
  )?.value;
  const initialThinkingSetting =
    parseThinkingSettingFromCookie(validatedModelId, thinkingCookieValue) ??
    getDefaultThinkingSetting(validatedModelId);

  return (
    <>
      <Chat
        autoResume={false}
        id={id}
        initialChatModel={validatedModelId}
        initialMessages={[]}
        initialThinkingSetting={initialThinkingSetting}
        isReadonly={false}
        key={id}
      />
      <DataStreamHandler />
    </>
  );
}
