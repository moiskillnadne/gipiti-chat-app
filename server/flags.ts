import { vercelAdapter } from "@flags-sdk/vercel";
import type { ReadonlyHeaders } from "flags";
import { dedupe, flag } from "flags/next";
import { getToken } from "next-auth/jwt";
import { getAuthSecret } from "@/lib/auth/secret";
import { isDevelopmentEnvironment } from "@/lib/constants";

export const isSignupEnabled = flag<boolean>({
  key: "isSignupEnabled",
  description: "Controls whether new user signup is available",
  // Fail open: an SDK/env misconfiguration must not silently disable signup
  defaultValue: true,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
  adapter: vercelAdapter(),
});

type UserEntities = {
  user?: { id: string };
};

// Resolve the current user from the session JWT for flag targeting rules
// (e.g. "user.id is <id>"). Uses the lightweight `getToken` instead of the
// full `auth()` chain so this file stays safe to import from proxy.ts.
const identifyUser = dedupe(
  async ({ headers }: { headers: ReadonlyHeaders }): Promise<UserEntities> => {
    const token = await getToken({
      req: { headers },
      secret: getAuthSecret(),
      secureCookie: !isDevelopmentEnvironment,
    });

    return token?.id ? { user: { id: token.id } } : {};
  }
);

export const isTopupEnabled = flag<boolean, UserEntities>({
  key: "isTopupEnabled",
  description: "Controls whether one-time balance top-up is available",
  // Fail closed: the rollout is gated to allowlisted users while the
  // purchase flow is verified in production.
  defaultValue: false,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
  identify: identifyUser,
  adapter: vercelAdapter(),
});
