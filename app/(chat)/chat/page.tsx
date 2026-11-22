import { redirect } from "next/navigation";
import { Chat } from "@/components/chat";
import { generateUUID } from "@/lib/utils";
import { auth } from "@/server/modules/auth/next-auth";

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
