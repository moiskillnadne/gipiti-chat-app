import { generateDummyPassword } from "@/server/db/utils";

/**
 * A bcrypt hash that matches no password. A login for an unknown email, or
 * for an account without a password, is compared against it, so that the
 * answer takes as long as a wrong password and does not reveal which emails
 * have an account. Generated once per process.
 */
export const DUMMY_PASSWORD = generateDummyPassword();
