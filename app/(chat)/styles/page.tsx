import { redirect } from "next/navigation";
import { AccountPageTopNav } from "@/components/account-page-top-nav";
import { StyleManager } from "@/components/style-manager";
import { auth } from "../../(auth)/auth";

export default async function StylesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <>
      <AccountPageTopNav currentLabelKey="styles" />
      <StyleManager />
    </>
  );
}
