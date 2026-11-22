import { describe, expect, it } from "vitest";
import {
  type AuthFormError,
  getForgotPasswordFormError,
  getLoginFormError,
  getRegisterFormError,
  getResetPasswordFormError,
  NETWORK_FORM_ERROR,
  PASSWORD_MISMATCH_FORM_ERROR,
} from "@/app/(auth)/_lib/form-errors";
import messages from "@/messages/ru.json" with { type: "json" };

const formErrorMessages: Record<string, string> = messages.auth.formErrors;

describe("getLoginFormError", () => {
  it("shows one message on both credential fields for a failed sign-in", () => {
    // Arrange
    const state = { status: "failed" } as const;

    // Act
    const formError = getLoginFormError(state);

    // Assert
    expect(formError).toEqual({
      messageKey: "invalidCredentials",
      fields: ["email", "password"],
    });
  });

  it("marks no field when the limiter refuses the attempt", () => {
    expect(getLoginFormError({ status: "rate_limited" })).toEqual({
      messageKey: "loginRateLimited",
      fields: [],
    });
  });

  it.each(["idle", "in_progress", "success"] as const)(
    "shows nothing for %s",
    (status) => {
      expect(getLoginFormError({ status })).toBeNull();
    }
  );
});

describe("getRegisterFormError", () => {
  it.each([
    ["invalid_data", "registerInvalidData", ["email", "password"]],
    ["user_exists", "userExists", ["email"]],
    ["disposable_email", "disposableEmail", ["email"]],
    ["rate_limited", "registerRateLimited", []],
    ["failed", "registerFailed", []],
  ] as const)("maps %s to %s", (status, messageKey, fields) => {
    expect(getRegisterFormError({ status })).toEqual({ messageKey, fields });
  });

  it("shows nothing after a successful sign-up", () => {
    expect(getRegisterFormError({ status: "success" })).toBeNull();
  });
});

describe("getForgotPasswordFormError", () => {
  it("names the wait in minutes when the limiter returns it", () => {
    expect(
      getForgotPasswordFormError({ status: "rate_limited", resetMinutes: 5 })
    ).toEqual({
      messageKey: "resetRequestRateLimitedFor",
      params: { minutes: 5 },
      fields: [],
    });
  });

  it.each([undefined, 0])(
    "falls back to a wait without a number for resetMinutes %s",
    (resetMinutes) => {
      expect(
        getForgotPasswordFormError({ status: "rate_limited", resetMinutes })
      ).toEqual({ messageKey: "resetRequestRateLimited", fields: [] });
    }
  );

  it("marks the email field for a malformed address", () => {
    expect(getForgotPasswordFormError({ status: "invalid_data" })).toEqual({
      messageKey: "emailInvalid",
      fields: ["email"],
    });
  });

  // An unknown email is answered with `success` by the server, like a known one.
  it("shows nothing on success", () => {
    expect(getForgotPasswordFormError({ status: "success" })).toBeNull();
  });
});

describe("getResetPasswordFormError", () => {
  it.each([
    ["invalid_data", "newPasswordInvalid", ["password"]],
    ["invalid_token", "resetLinkInvalid", []],
    ["failed", "resetFailed", []],
  ] as const)("maps %s to %s", (status, messageKey, fields) => {
    expect(getResetPasswordFormError({ status })).toEqual({
      messageKey,
      fields,
    });
  });
});

describe("auth form error messages", () => {
  const allErrors: AuthFormError[] = [
    NETWORK_FORM_ERROR,
    PASSWORD_MISMATCH_FORM_ERROR,
    ...(["failed", "invalid_data", "rate_limited"] as const).map(
      (status) => getLoginFormError({ status }) as AuthFormError
    ),
    ...(
      [
        "failed",
        "invalid_data",
        "rate_limited",
        "user_exists",
        "disposable_email",
      ] as const
    ).map((status) => getRegisterFormError({ status }) as AuthFormError),
    ...(["failed", "invalid_data", "rate_limited"] as const).map(
      (status) => getForgotPasswordFormError({ status }) as AuthFormError
    ),
    getForgotPasswordFormError({
      status: "rate_limited",
      resetMinutes: 3,
    }) as AuthFormError,
    ...(["failed", "invalid_data", "invalid_token"] as const).map(
      (status) => getResetPasswordFormError({ status }) as AuthFormError
    ),
  ];

  it.each(allErrors.map((formError) => formError.messageKey))(
    "%s exists in ru.json without an exclamation mark",
    (messageKey) => {
      const message = formErrorMessages[messageKey];

      expect(message).toBeTypeOf("string");
      expect(message).not.toContain("!");
    }
  );
});
