import { normalizeEmail } from "../../../auth/normalize-email";
import { creditBalance, ensureBalance } from "../../../billing/balance";
import {
  DEFAULT_CURRENCY_CODE,
  WELCOME_GRANT_MAJOR_UNITS,
} from "../../../billing/constants";
import { majorToMinorUnits } from "../../../billing/money";
import { ChatSDKError } from "../../../errors";
import type { RegistrationGeo } from "../../../geo/registration-geo";
import type { UtmData } from "../../../utm/constants";
import { db } from "../../connection";
import { user } from "../../schema";
import { isUniqueViolation } from "../../unique-violation";
import { generateHashedPassword } from "../../utils";

/**
 * Raised when an address is already registered. The register action pre-checks
 * with `getUserByEmail`, but that check and the insert are not atomic — two
 * concurrent submissions of the same address both pass it. The unique index is
 * what actually decides, so the race loser surfaces here instead of as an
 * opaque database failure.
 */
export class DuplicateEmailError extends Error {
  constructor(email: string) {
    super(`Email already registered: ${email}`);
    this.name = "DuplicateEmailError";
  }
}

export async function createUser(
  email: string,
  password: string,
  utmData?: UtmData,
  registrationGeo?: RegistrationGeo
) {
  const hashedPassword = generateHashedPassword(password);
  const normalizedEmail = normalizeEmail(email);

  let newUser: typeof user.$inferSelect;

  try {
    const [created] = await db
      .insert(user)
      .values({
        email: normalizedEmail,
        password: hashedPassword,
        ...(utmData && {
          utmSource: utmData.utmSource,
          utmMedium: utmData.utmMedium,
          utmCampaign: utmData.utmCampaign,
          utmContent: utmData.utmContent,
          utmTerm: utmData.utmTerm,
        }),
        ...(registrationGeo && {
          registrationCountry: registrationGeo.country,
          registrationRegion: registrationGeo.region,
          registrationCity: registrationGeo.city,
          registrationLanguage: registrationGeo.language,
        }),
      })
      .returning();

    newUser = created;
  } catch (error) {
    // Never fall through to the generic failure: the grant below must not run
    // for an address that already has an account.
    if (isUniqueViolation(error)) {
      throw new DuplicateEmailError(normalizedEmail);
    }

    throw new ChatSDKError("bad_request:database", "Failed to create user");
  }

  // Seed the currency-based balance: ensure a zeroed RUB row, then credit the
  // one-time welcome grant to the persistent top-up pool so it never resets.
  await ensureBalance(newUser.id, DEFAULT_CURRENCY_CODE);
  await creditBalance({
    userId: newUser.id,
    pool: "topup",
    amount: majorToMinorUnits(WELCOME_GRANT_MAJOR_UNITS, 2),
    type: "welcome",
    description: "Welcome grant",
  });

  return newUser;
}
