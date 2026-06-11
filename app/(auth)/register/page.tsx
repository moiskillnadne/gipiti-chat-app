import { redirect } from "next/navigation";
import { isSignupEnabled } from "@/lib/flags";
import { RegisterPageClient } from "./register-page-client";

export default async function Page() {
  const isEnabled = await isSignupEnabled();

  if (!isEnabled) {
    redirect("/login");
  }

  return <RegisterPageClient />;
}
