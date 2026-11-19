import {
  DEFAULT_CURRENCY_CODE,
  EMAIL_CONFIRM_BONUS_MAJOR_UNITS,
  ONBOARDING_QUIZ_BONUS_MAJOR_UNITS,
  TOPUP_MAX_MAJOR_UNITS,
  TOPUP_MIN_MAJOR_UNITS,
  TOPUP_PRESETS_MAJOR_UNITS,
  WELCOME_GRANT_MAJOR_UNITS,
} from "@/lib/billing/constants";
import { majorToMinorUnits } from "@/lib/billing/money";
import type { Config } from "@/server/api/v1/_schemas/config";
import type { Money } from "@/server/api/v1/_schemas/money";

type ConfigInput = {
  isSignupEnabled: boolean;
  /** Minor-unit exponent of the default currency (2 for RUB). */
  minorUnits: number;
};

/** Not configured until the native apps ship (roadmap Phase 10). */
const UNSET_CLIENT_VERSIONS = {
  minSupportedVersion: null,
  latestVersion: null,
  updateUrl: null,
} as const;

/** The public config: the billing constants as money, plus the signup flag. */
export const toConfigDto = ({
  isSignupEnabled,
  minorUnits,
}: ConfigInput): Config => {
  const inDefaultCurrency = (majorUnits: number): Money => ({
    amountMinor: majorToMinorUnits(majorUnits, minorUnits),
    currencyCode: DEFAULT_CURRENCY_CODE,
  });

  return {
    clients: { ios: UNSET_CLIENT_VERSIONS, android: UNSET_CLIENT_VERSIONS },
    features: { signup: isSignupEnabled },
    bonuses: {
      welcome: inDefaultCurrency(WELCOME_GRANT_MAJOR_UNITS),
      emailConfirm: inDefaultCurrency(EMAIL_CONFIRM_BONUS_MAJOR_UNITS),
      onboardingQuiz: inDefaultCurrency(ONBOARDING_QUIZ_BONUS_MAJOR_UNITS),
    },
    topup: {
      minimum: inDefaultCurrency(TOPUP_MIN_MAJOR_UNITS),
      maximum: inDefaultCurrency(TOPUP_MAX_MAJOR_UNITS),
      presets: TOPUP_PRESETS_MAJOR_UNITS.map(inDefaultCurrency),
    },
  };
};
