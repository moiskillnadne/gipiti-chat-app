import { redirect } from "next/navigation";
import { AccountPageTopNav } from "@/components/account-page-top-nav";
import { PromptLibrary } from "@/components/prompt-library/prompt-library";
import { auth } from "../../(auth)/auth";

export default async function PromptsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <>
      <AccountPageTopNav currentLabelKey="promptLibrary" />
      <PromptLibrary />
    </>
  );
}
