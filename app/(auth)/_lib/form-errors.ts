import type {
  ForgotPasswordActionState,
  LoginActionState,
  RegisterActionState,
  ResetPasswordActionState,
} from "@/app/(auth)/actions";
import type { TranslationParams } from "@/lib/i18n/format";

/** A field of the auth forms an error can point at. */
export type AuthFormField = "email" | "password" | "confirmPassword";

/**
 * What an auth form shows after a failed submit: a key in the
 * `auth.formErrors` namespace and the fields the message is about. The first
 * field receives focus; an empty list means the form as a whole failed
 * (server down, too many attempts), so no field is marked invalid.
 */
export type AuthFormError = {
  messageKey: string;
  params?: TranslationParams;
  fields: readonly AuthFormField[];
};

const CREDENTIAL_FIELDS: readonly AuthFormField[] = ["email", "password"];

/** The server could not be reached, or it answered with an error page. */
export const NETWORK_FORM_ERROR: AuthFormError = {
  messageKey: "network",
  fields: [],
};

/** The two password fields on `/reset-password` hold different values. */
export const PASSWORD_MISMATCH_FORM_ERROR: AuthFormError = {
  messageKey: "passwordMismatch",
  fields: ["confirmPassword"],
};

/**
 * Login keeps one message for an unknown email and a wrong password, so the
 * form never tells whether an account exists.
 */
export const getLoginFormError = ({
  status,
}: LoginActionState): AuthFormError | null => {
  switch (status) {
    case "failed":
      return { messageKey: "invalidCredentials", fields: CREDENTIAL_FIELDS };
    case "invalid_data":
      return { messageKey: "loginInvalidData", fields: CREDENTIAL_FIELDS };
    case "rate_limited":
      return { messageKey: "loginRateLimited", fields: [] };
    default:
      return null;
  }
};

export const getRegisterFormError = ({
  status,
}: RegisterActionState): AuthFormError | null => {
  switch (status) {
    case "invalid_data":
      return { messageKey: "registerInvalidData", fields: CREDENTIAL_FIELDS };
    // The server already tells this state apart; whether it should is
    // GIPITI-203. The wording only points to the next step.
    case "user_exists":
      return { messageKey: "userExists", fields: ["email"] };
    case "disposable_email":
      return { messageKey: "disposableEmail", fields: ["email"] };
    case "rate_limited":
      return { messageKey: "registerRateLimited", fields: [] };
    case "failed":
      return { messageKey: "registerFailed", fields: [] };
    default:
      return null;
  }
};

/**
 * An unknown email gets `success`, the same as a known one, so this mapping
 * cannot tell them apart either.
 */
export const getForgotPasswordFormError = ({
  status,
  resetMinutes,
}: ForgotPasswordActionState): AuthFormError | null => {
  switch (status) {
    case "invalid_data":
      return { messageKey: "emailInvalid", fields: ["email"] };
    case "rate_limited":
      return resetMinutes && resetMinutes > 0
        ? {
            messageKey: "resetRequestRateLimitedFor",
            params: { minutes: resetMinutes },
            fields: [],
          }
        : { messageKey: "resetRequestRateLimited", fields: [] };
    case "failed":
      return { messageKey: "resetRequestFailed", fields: [] };
    default:
      return null;
  }
};

export const getResetPasswordFormError = ({
  status,
}: ResetPasswordActionState): AuthFormError | null => {
  switch (status) {
    case "invalid_data":
      return { messageKey: "newPasswordInvalid", fields: ["password"] };
    case "invalid_token":
      return { messageKey: "resetLinkInvalid", fields: [] };
    case "failed":
      return { messageKey: "resetFailed", fields: [] };
    default:
      return null;
  }
};
