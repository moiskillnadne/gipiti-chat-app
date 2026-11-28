import { DEFAULT_CURRENCY_CODE } from "@/lib/billing/constants";
import { toConfigDto } from "@/server/api/v1/_mappers/config";
import { v1 } from "@/server/api/v1/implementer";
import { isSignupEnabled } from "@/server/flags";
import { getMinorUnits } from "@/server/modules/billing/currencies";

export const configRouter = {
  get: v1.config.get.handler(async () => {
    const [isSignupOn, minorUnits] = await Promise.all([
      isSignupEnabled(),
      getMinorUnits(DEFAULT_CURRENCY_CODE),
    ]);

    return toConfigDto({ isSignupEnabled: isSignupOn, minorUnits });
  }),
};
