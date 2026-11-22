import { creditBalance, ensureBalance } from "@/lib/billing/balance";
import {
  DEFAULT_CURRENCY_CODE,
  WELCOME_GRANT_MAJOR_UNITS,
} from "@/lib/billing/constants";
import { getMinorUnits } from "@/lib/billing/currencies";
import { majorToMinorUnits } from "@/lib/billing/money";
import { ChatSDKError } from "@/lib/errors";
import type { UtmData } from "@/lib/utm/constants";
import { type DatabaseExecutor, db } from "@/server/db/connection";
import { type User, user } from "@/server/db/schema";
import { isUniqueViolation } from "@/server/db/unique-violation";
import { generateHashedPassword } from "@/server/db/utils";
import { normalizeEmail } from "@/server/modules/auth/normalize-email";
import type { RegistrationGeo } from "@/server/modules/auth/registration-geo";

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

type NewUserValues = {
  email: string;
  hashedPassword: string;
  utmData?: UtmData;
  registrationGeo?: RegistrationGeo;
};

/**
 * Insert the `User` row on the given executor.
 *
 * @throws DuplicateEmailError when the address already has an account
 * @throws ChatSDKError for any other insert failure
 */
const insertUser = async (
  executor: DatabaseExecutor,
  { email, hashedPassword, utmData, registrationGeo }: NewUserValues
): Promise<User> => {
  try {
    const [created] = await executor
      .insert(user)
      .values({
        email,
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

    return created;
  } catch (error) {
    // Never fall through to the generic failure: the caller must tell an
    // address that already has an account apart from a database failure.
    if (isUniqueViolation(error)) {
      throw new DuplicateEmailError(email);
    }

    throw new ChatSDKError("bad_request:database", "Failed to create user");
  }
};

/**
 * Create an account together with its balance row and one-time welcome grant.
 *
 * All three are written in one transaction: a failure after the insert rolls
 * the account back, and the same email can sign up again. An account that
 * outlived a failed grant could not be repaired, because the register action
 * reports a failure and every retry then finds the email taken.
 *
 * @throws DuplicateEmailError when the address already has an account; nothing
 * is granted
 */
export async function createUser(
  email: string,
  password: string,
  utmData?: UtmData,
  registrationGeo?: RegistrationGeo
): Promise<User> {
  // Hashed before the transaction: bcrypt is slow and must not hold a
  // connection.
  const hashedPassword = generateHashedPassword(password);
  const normalizedEmail = normalizeEmail(email);

  // Every query below goes through `tx`. A query through `db` here would wait
  // for a second pool connection while this transaction holds the first.
  return await db.transaction(async (tx) => {
    const newUser = await insertUser(tx, {
      email: normalizedEmail,
      hashedPassword,
      utmData,
      registrationGeo,
    });

    // Seed the currency-based balance: ensure a zeroed row, then credit the
    // welcome grant to the persistent top-up pool so it never resets.
    await ensureBalance(newUser.id, DEFAULT_CURRENCY_CODE, tx);
    const minorUnits = await getMinorUnits(DEFAULT_CURRENCY_CODE, tx);
    await creditBalance(
      {
        userId: newUser.id,
        pool: "topup",
        amount: majorToMinorUnits(WELCOME_GRANT_MAJOR_UNITS, minorUnits),
        type: "welcome",
        description: "Welcome grant",
      },
      tx
    );

    return newUser;
  });
}
