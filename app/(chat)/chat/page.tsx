import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { Chat } from "@/components/chat";
import { isIntegrationsAvailableForUser } from "@/lib/integrations/availability";
import { generateUUID } from "@/lib/utils";

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const id = generateUUID();
  const isIntegrationsAvailable = await isIntegrationsAvailableForUser(
    session.user.id
  );

  return (
    <Chat
      autoResume={false}
      id={id}
      initialMessages={[]}
      isIntegrationsAvailable={isIntegrationsAvailable}
      isReadonly={false}
      key={id}
    />
  );
}
