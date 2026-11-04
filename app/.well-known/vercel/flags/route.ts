import { getProviderData } from "@flags-sdk/vercel";
import { createFlagsDiscoveryEndpoint } from "flags/next";
import {
  isIntegrationsEnabled,
  isSignupEnabled,
  isTopupEnabled,
} from "@/lib/flags";

export const GET = createFlagsDiscoveryEndpoint(async () =>
  getProviderData({ isIntegrationsEnabled, isSignupEnabled, isTopupEnabled })
);
