import { vercelAdapter } from "@flags-sdk/vercel";
import { flag } from "flags/next";

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
