import { redirect } from "next/navigation";
import { AccountPageTopNav } from "@/components/account-page-top-nav";
import { auth } from "@/server/modules/auth/next-auth";
import { ManageSubscriptionPageClient } from "./manage-subscription-page-client";

export default async function ManageSubscriptionPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <>
      <AccountPageTopNav currentLabelKey="subscription" />
      <ManageSubscriptionPageClient />
    </>
  );
}
