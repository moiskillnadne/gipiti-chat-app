import {
  DEFAULT_CURRENCY_CODE,
  WELCOME_GRANT_MAJOR_UNITS,
} from "@/lib/billing/constants";
import { majorToMinorUnits } from "@/lib/billing/money";
import { ChatSDKError } from "@/lib/errors";
import type { UtmData } from "@/lib/utm/constants";
import { type DatabaseExecutor, db } from "@/server/db/connection";
import { type User, user } from "@/server/db/schema";
import { isUniqueViolation } from "@/server/db/unique-violation";
import { generateHashedPassword } from "@/server/db/utils";
import { normalizeEmail } from "@/server/modules/auth/normalize-email";
import type { RegistrationGeo } from "@/server/modules/auth/registration-geo";
import { creditBalance, ensureBalance } from "@/server/modules/billing/balance";
import { getMinorUnits } from "@/server/modules/billing/currencies";
import type { SignupPlatform } from "@/server/modules/users/signup-platform";

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
  signupPlatform?: SignupPlatform;
};

/**
 * Insert the `User` row on the given executor.
 *
 * @throws DuplicateEmailError when the address already has an account
 * @throws ChatSDKError for any other insert failure
 */
const insertUser = async (
  executor: DatabaseExecutor,
  {
    email,
    hashedPassword,
    utmData,
    registrationGeo,
    signupPlatform,
  }: NewUserValues
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
        ...(signupPlatform !== undefined && { signupPlatform }),
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

type NewAccountInput = {
  email: string;
  password: string;
  utmData?: UtmData;
  registrationGeo?: RegistrationGeo;
  /** Set for a sign-up through the API; its welcome grant is deferred. */
  signupPlatform?: SignupPlatform;
};

/**
 * Writes the `User` row and its balance row in one transaction, and credits
 * the welcome grant in the same transaction unless the account is created
 * with a sign-up platform.
 */
const createAccount = async ({
  email,
  password,
  utmData,
  registrationGeo,
  signupPlatform,
}: NewAccountInput): Promise<User> => {
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
      signupPlatform,
    });

    // Seed the currency-based balance with a zeroed row.
    await ensureBalance(newUser.id, DEFAULT_CURRENCY_CODE, tx);

    // The welcome grant of an API sign-up waits for the email to be verified
    // (`grantDeferredWelcomeBonus`).
    if (signupPlatform !== undefined) {
      return newUser;
    }

    // Credited to the persistent top-up pool, so it never resets.
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
};

/**
 * Create an account together with its balance row and one-time welcome grant.
 * This is the website's sign-up.
 *
 * All three are written in one transaction: a failure after the insert rolls
 * the account back, and the same email can sign up again. An account that
 * outlived a failed grant could not be repaired, because the register action
 * reports a failure and every retry then finds the email taken.
 *
 * @throws DuplicateEmailError when the address already has an account; nothing
 * is granted
 */
export function createUser(
  email: string,
  password: string,
  utmData?: UtmData,
  registrationGeo?: RegistrationGeo
): Promise<User> {
  return createAccount({ email, password, utmData, registrationGeo });
}

/**
 * Create an account for a sign-up through the API: the same account and
 * balance row, with `signup_platform` recorded and **no welcome grant yet**.
 * The grant is credited when the email is verified.
 *
 * The API is easy to script, and a script must not be paid for an address
 * nobody reads; a verified mailbox is what the grant waits for.
 *
 * @throws DuplicateEmailError when the address already has an account
 */
export function createUserWithDeferredWelcomeGrant(
  input: Required<
    Pick<NewAccountInput, "email" | "password" | "signupPlatform">
  > &
    Pick<NewAccountInput, "utmData" | "registrationGeo">
): Promise<User> {
  return createAccount(input);
}
