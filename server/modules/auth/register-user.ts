import type { UtmData } from "@/lib/utm/constants";
import type { User } from "@/server/db/schema";
import { isSignupEnabled } from "@/server/flags";
import { checkRegisterRateLimit } from "@/server/http/rate-limit";
import { isDisposableEmail } from "@/server/modules/auth/disposable-email-domains";
import { isAcceptablePassword } from "@/server/modules/auth/password-policy";
import type { RegistrationGeo } from "@/server/modules/auth/registration-geo";
import {
  createUser,
  DuplicateEmailError,
} from "@/server/modules/users/queries/create-user";
import { getUserByEmail } from "@/server/modules/users/queries/get-by-email";

export type RegisterUserInput = {
  /** A syntactically valid email; the caller checks the format. */
  email: string;
  password: string;
  /** The caller's address, or null when it is not known. */
  ip: string | null;
  utm?: UtmData;
  geo: RegistrationGeo;
};

export type RegisterUserResult =
  | { status: "registered"; user: User }
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
    const user = await createUser(email, password, utm, geo);

    return { status: "registered", user };
  } catch (error) {
    // Lost the race against a concurrent sign-up with the same address: the
    // unique index rejected the insert. Same outcome as the check above.
    if (error instanceof DuplicateEmailError) {
      return { status: "user_exists" };
    }

    throw error;
  }
};
