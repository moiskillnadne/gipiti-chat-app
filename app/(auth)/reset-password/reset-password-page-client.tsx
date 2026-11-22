"use client";

import Form from "next/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { AuthPageLayout } from "@/components/auth-page-layout";
import { FormError } from "@/components/form-error";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { useTranslations } from "@/lib/i18n/translate";

import {
  getResetPasswordFormError,
  PASSWORD_MISMATCH_FORM_ERROR,
} from "../_lib/form-errors";
import { useAuthFormError } from "../_lib/use-auth-form-error";
import { type ResetPasswordActionState, resetPassword } from "../actions";

const RESET_PASSWORD_FIELD_IDS = {
  password: "password-display",
  confirmPassword: "confirm-password",
} as const;
const RESET_PASSWORD_ERROR_ID = "reset-password-form-error";

type ResetPasswordPageClientProps = {
  /** The reset token from the link, read from the URL by the server page. */
  token: string;
};

// The token arrives as a prop instead of through `useSearchParams()`: that
// hook needs a `<Suspense>` boundary, and under a boundary that suspends on
// the server React streams the form into a hidden element and can render a
// second copy on the client (GIPITI-229).
export function ResetPasswordPageClient({
  token,
}: ResetPasswordPageClientProps) {
  const t = useTranslations("auth.resetPassword");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);
  const errorControls = useAuthFormError({
    errorId: RESET_PASSWORD_ERROR_ID,
    fieldIds: RESET_PASSWORD_FIELD_IDS,
  });

  const [state, formAction] = useActionState<
    ResetPasswordActionState,
    FormData
  >(
    (previousState, formData) =>
      errorControls.runAction(
        () => resetPassword(previousState, formData),
        getResetPasswordFormError,
        previousState
      ),
    { status: "idle" }
  );

  useEffect(() => {
    // Failures are shown inline by `errorControls`.
    if (isSuccessful || state.status !== "success") {
      return;
    }

    setIsSuccessful(true);

    toast({
      type: "success",
      description: t("success"),
    });

    // Redirect to login after 2 seconds
    setTimeout(() => {
      router.push("/login");
    }, 2000);
  }, [state.status, router, t, isSuccessful]);

  const handleSubmit = (formData: FormData) => {
    if (password !== confirmPassword) {
      errorControls.showError(PASSWORD_MISMATCH_FORM_ERROR);
      return;
    }

    formData.append("token", token);
    formAction(formData);
  };

  // Show error if no token in URL
  if (!token) {
    return (
      <AuthPageLayout>
        <div className="flex flex-col items-center justify-center gap-6 px-4 text-center sm:px-16">
          <h3 className="font-semibold text-2xl">{t("invalidToken")}</h3>
          <p className="text-gray-500 text-sm">{t("invalidTokenMessage")}</p>
          <Link
            className="font-semibold text-gray-800 hover:underline"
            href="/forgot-password"
          >
            {t("requestNewLink")}
          </Link>
        </div>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout>
      <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
        <h3 className="font-semibold text-2xl">{t("title")}</h3>
        <p className="text-gray-500 text-sm">{t("subtitle")}</p>
      </div>

      <Form
        action={handleSubmit}
        className="flex flex-col gap-4 px-4 sm:px-16"
        {...errorControls.formProps}
      >
        <div className="flex flex-col gap-2">
          <PasswordInput
            autoComplete="new-password"
            autoFocus
            disabled={isSuccessful}
            id={RESET_PASSWORD_FIELD_IDS.password}
            label={t("passwordLabel")}
            name="password-display"
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("passwordPlaceholder")}
            required
            showRequirements
            value={password}
            {...errorControls.getFieldProps("password")}
          />
          {/* Hidden input to submit password with form */}
          <input name="password" type="hidden" value={password} />
        </div>

        <div className="flex flex-col gap-2">
          <PasswordInput
            autoComplete="new-password"
            disabled={isSuccessful}
            id={RESET_PASSWORD_FIELD_IDS.confirmPassword}
            label={t("confirmLabel")}
            name="confirm-password"
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t("confirmPlaceholder")}
            required
            showRequirements={false}
            value={confirmPassword}
            {...errorControls.getFieldProps("confirmPassword")}
          />

          {/* Live match indicator; the form error replaces it after a submit */}
          {confirmPassword && !errorControls.formError && (
            <div className="flex items-center gap-2 text-sm">
              {password === confirmPassword ? (
                <>
                  <svg
                    aria-hidden="true"
                    className="size-4 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M5 13l4 4L19 7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-green-600">{t("passwordMatches")}</span>
                </>
              ) : (
                <>
                  <svg
                    aria-hidden="true"
                    className="size-4 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M6 18L18 6M6 6l12 12"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-red-600">{t("passwordMismatch")}</span>
                </>
              )}
            </div>
          )}
        </div>

        <FormError id={errorControls.errorId} message={errorControls.message}>
          {errorControls.formError?.messageKey === "resetLinkInvalid" && (
            <Link className="font-semibold underline" href="/forgot-password">
              {t("requestNewLink")}
            </Link>
          )}
        </FormError>

        <SubmitButton isSuccessful={isSuccessful}>{t("submit")}</SubmitButton>

        <p className="mt-4 text-center text-gray-600 text-sm">
          <Link
            className="font-semibold text-gray-800 hover:underline"
            href="/login"
          >
            {t("backToLogin")}
          </Link>
        </p>
      </Form>
    </AuthPageLayout>
  );
}
