import { isSignupEnabled } from "@/lib/flags";
import { LoginPageClient } from "./login-page-client";

export default async function Page() {
  const showSignup = await isSignupEnabled();

  return <LoginPageClient showSignup={showSignup} />;
}
