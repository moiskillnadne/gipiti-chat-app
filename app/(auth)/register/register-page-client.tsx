"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";
import { AUTH_FORM_FIELD_IDS, AuthForm } from "@/components/auth-form";
import { AuthPageHeader } from "@/components/auth-page-header";
import { AuthPageLayout } from "@/components/auth-page-layout";
import { SubmitButton } from "@/components/submit-button";
import { useTranslations } from "@/lib/i18n/translate";
import { getRegisterFormError } from "../_lib/form-errors";
import { useAuthFormError } from "../_lib/use-auth-form-error";
import { type RegisterActionState, register } from "../actions";

const REGISTER_ERROR_ID = "register-form-error";

// No `<Suspense>` here: the form must be part of the first HTML chunk. Under a
// boundary that suspends on the server, React streams the form into a hidden
// element next to a fallback and, when the session request resolves before
// the swap, renders a second copy on the client (GIPITI-229).
export function RegisterPageClient() {
  const t = useTranslations("auth.register");
  const router = useRouter();

  const [isSuccessful, setIsSuccessful] = useState(false);

  // navigator is client-only; read it after mount and submit via a hidden field
  // so the registration action can persist the user's preferred language.
  const [browserLanguage, setBrowserLanguage] = useState("");

  useEffect(() => {
    setBrowserLanguage(navigator.language);
  }, []);

  const errorControls = useAuthFormError({
    errorId: REGISTER_ERROR_ID,
    fieldIds: AUTH_FORM_FIELD_IDS,
  });

  const [state, formAction] = useActionState<RegisterActionState, FormData>(
    (previousState, formData) =>
      errorControls.runAction(
        () => register(previousState, formData),
        getRegisterFormError,
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

    updateSession().finally(() => {
      router.replace("/chat");
    });
  }, [router, state.status, isSuccessful, updateSession]);

  return (
    <AuthPageLayout>
      <AuthPageHeader subtitle={t("subtitle")} title={t("title")} />
      <AuthForm
        action={formAction}
        errorControls={errorControls}
        mode="register"
      >
        <input name="language" type="hidden" value={browserLanguage} />
        <SubmitButton isSuccessful={isSuccessful}>
          {t("signUpButton")}
        </SubmitButton>
        <p className="mt-4 text-center text-gray-600 text-sm">
          {t("hasAccount")}{" "}
          <Link
            className="font-semibold text-gray-800 hover:underline"
            href="/login"
          >
            {t("signInLink")}
          </Link>
        </p>
      </AuthForm>
    </AuthPageLayout>
  );
}
