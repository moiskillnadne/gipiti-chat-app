import { getProviderData } from "@flags-sdk/vercel";
import { createFlagsDiscoveryEndpoint } from "flags/next";
import { isSignupEnabled } from "@/lib/flags";

export const GET = createFlagsDiscoveryEndpoint(async () =>
  getProviderData({ isSignupEnabled })
);
