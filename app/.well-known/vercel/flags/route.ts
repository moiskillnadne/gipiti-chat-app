import { getProviderData } from "@flags-sdk/vercel";
import { createFlagsDiscoveryEndpoint } from "flags/next";
import { isSignupEnabled, isTopupEnabled } from "@/server/flags";

export const GET = createFlagsDiscoveryEndpoint(async () =>
  getProviderData({ isSignupEnabled, isTopupEnabled })
);
