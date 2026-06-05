import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { AccountPageTopNav } from "@/components/account-page-top-nav";
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
