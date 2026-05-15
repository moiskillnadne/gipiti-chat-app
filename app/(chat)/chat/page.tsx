import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { Chat } from "@/components/chat";
import { generateUUID } from "@/lib/utils";

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const id = generateUUID();

  return (
    <Chat
      autoResume={false}
      id={id}
      initialMessages={[]}
      isReadonly={false}
      key={id}
    />
  );
}
