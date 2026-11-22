import type { UtmData } from "@/lib/utm/constants";
import { isSignupEnabled } from "@/server/flags";
import { checkRegisterRateLimit } from "@/server/http/rate-limit";
import { type Account, toAccount } from "@/server/modules/auth/account";
import { isDisposableEmail } from "@/server/modules/auth/disposable-email-domains";
import { isAcceptablePassword } from "@/server/modules/auth/password-policy";
import type { RegistrationGeo } from "@/server/modules/auth/registration-geo";
import {
  createUser,
  createUserWithDeferredWelcomeGrant,
  DuplicateEmailError,
} from "@/server/modules/users/queries/create-user";
import { getUserByEmail } from "@/server/modules/users/queries/get-by-email";
import type { SignupPlatform } from "@/server/modules/users/signup-platform";

export type RegisterUserInput = {
  /** A syntactically valid email; the caller checks the format. */
  email: string;
  password: string;
  /** The caller's address, or null when it is not known. */
  ip: string | null;
  utm?: UtmData;
  geo: RegistrationGeo;
  /**
   * Set for a sign-up through the API (`ios`, `android`). Such an account
   * gets its welcome grant when the email is verified, not now: the API is
   * easy to script, and the platform is whatever the caller says it is, so
   * the rule depends on the door that was used, not on the value: any
   * platform at all, as opposed to none, defers the grant.
   */
  signupPlatform?: SignupPlatform;
};

export type RegisterUserResult =
  | { status: "registered"; account: Account }
  /** Sign-up is switched off by the `isSignupEnabled` flag. */
  | { status: "signup_disabled" }
  | { status: "weak_password" }
  | { status: "rate_limited" }
  /** The sign-up limit could not be checked, so the request is refused. */
  | { status: "limiter_unavailable" }
  | { status: "disposable_email" }
  | { status: "user_exists" };

/**
 * Creates an account. The checks run in this order: the sign-up flag, the
 * password rule, the per-address limit, the throwaway-mailbox list, an
 * existing account.
 *
 * @throws whatever `createUser` throws, except a lost race for the email,
 * which is reported as `user_exists`
 */
export const registerUser = async ({
  email,
  password,
  ip,
  utm,
  geo,
  signupPlatform,
}: RegisterUserInput): Promise<RegisterUserResult> => {
  // Sign-up can be switched off remotely.
  if (!(await isSignupEnabled())) {
    return { status: "signup_disabled" };
  }

  if (!isAcceptablePassword(password)) {
    return { status: "weak_password" };
  }

  const rateLimitResult = await checkRegisterRateLimit(ip);
  if (rateLimitResult.isUnavailable) {
    return { status: "limiter_unavailable" };
  }
  if (!rateLimitResult.success) {
    return { status: "rate_limited" };
  }

  if (isDisposableEmail(email)) {
    return { status: "disposable_email" };
  }

  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    return { status: "user_exists" };
  }

  try {
    const user =
      signupPlatform === undefined
        ? await createUser(email, password, utm, geo)
        : await createUserWithDeferredWelcomeGrant({
            email,
            password,
            utmData: utm,
            registrationGeo: geo,
            signupPlatform,
          });

    return { status: "registered", account: toAccount(user) };
  } catch (error) {
    // Lost the race against a concurrent sign-up with the same address: the
    // unique index rejected the insert. Same outcome as the check above.
    if (error instanceof DuplicateEmailError) {
      return { status: "user_exists" };
    }

    throw error;
  }
};
