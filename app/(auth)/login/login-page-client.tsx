"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";
import { AUTH_FORM_FIELD_IDS, AuthForm } from "@/components/auth-form";
import { AuthPageHeader } from "@/components/auth-page-header";
import { AuthPageLayout } from "@/components/auth-page-layout";
import { SubmitButton } from "@/components/submit-button";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect-path";
import { useTranslations } from "@/lib/i18n/translate";
import { getLoginFormError } from "../_lib/form-errors";
import { useAuthFormError } from "../_lib/use-auth-form-error";
import { type LoginActionState, login } from "../actions";

const CALLBACK_URL_PARAM = "callbackUrl";
const LOGIN_ERROR_ID = "login-form-error";

type LoginPageClientProps = {
  showSignup: boolean;
};

/**
 * Where to send the user after a successful login: the `callbackUrl` query
 * parameter when it stays on this origin, the chat otherwise (the rule is in
 * `getSafeRedirectPath`).
 *
 * Browser-only (call it from an effect or an event handler). It reads
 * `window.location` instead of `useSearchParams()` on purpose: that hook
 * needs a `<Suspense>` boundary around the page, and the boundary made the
 * server stream the form into a hidden `<div hidden id="S:0">` next to a
 * loader fallback. For up to 300 ms the DOM then held that hidden copy and,
 * once the session request resolved, a second client-rendered form with the
 * same ids, and the server-rendered form was thrown away (GIPITI-229).
 */
const getRedirectPath = (): string =>
  getSafeRedirectPath(
    new URLSearchParams(window.location.search).get(CALLBACK_URL_PARAM),
    window.location.origin
  );

// No `<Suspense>` here: the form must be part of the first HTML chunk, see
// `getRedirectPath`.
export function LoginPageClient({ showSignup }: LoginPageClientProps) {
  const t = useTranslations("auth.login");
  const router = useRouter();

  const [isSuccessful, setIsSuccessful] = useState(false);
  const errorControls = useAuthFormError({
    errorId: LOGIN_ERROR_ID,
    fieldIds: AUTH_FORM_FIELD_IDS,
  });

  const [state, formAction] = useActionState<LoginActionState, FormData>(
    (previousState, formData) =>
      errorControls.runAction(
        () => login(previousState, formData),
        getLoginFormError,
        previousState
      ),
    { status: "idle" }
  );

  const { update: updateSession } = useSession();

  useEffect(() => {
    // Failures are shown inline by `errorControls`.
    if (isSuccessful || state.status !== "success") {
      return;
    }

    setIsSuccessful(true);

    const redirectPath = getRedirectPath();

    updateSession().then(() => {
      router.replace(redirectPath);
    });
  }, [router, state.status, updateSession, isSuccessful]);

  return (
    <AuthPageLayout>
      <AuthPageHeader subtitle={t("subtitle")} title={t("title")} />
      <AuthForm action={formAction} errorControls={errorControls} mode="login">
        <div className="flex items-center justify-end">
          <Link
            className="text-gray-600 text-sm hover:underline"
            href="/forgot-password"
          >
            {t("forgotPasswordLink")}
          </Link>
        </div>
        <SubmitButton isSuccessful={isSuccessful}>
          {t("signInButton")}
        </SubmitButton>

        {showSignup && (
          <p className="mt-4 text-center text-gray-600 text-sm">
            {t("noAccount")}{" "}
            <Link
              className="font-semibold text-gray-800 hover:underline"
              href="/register"
            >
              {t("signUpLink")}
            </Link>{" "}
            {t("signUpLinkSuffix")}
          </p>
        )}
      </AuthForm>
    </AuthPageLayout>
  );
}
