"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";
import { AuthForm } from "@/components/auth-form";
import { AuthPageHeader } from "@/components/auth-page-header";
import { AuthPageLayout } from "@/components/auth-page-layout";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { useTranslations } from "@/lib/i18n/translate";
import { type RegisterActionState, register } from "../actions";

// No `<Suspense>` here: the form must be part of the first HTML chunk. Under a
// boundary that suspends on the server, React streams the form into a hidden
// element next to a fallback and, when the session request resolves before
// the swap, renders a second copy on the client (GIPITI-229).
export function RegisterPageClient() {
  const t = useTranslations("auth.register");
  const tErrors = useTranslations("auth.errors");
  const tNotifications = useTranslations("common.notifications");
  const router = useRouter();

  const [isSuccessful, setIsSuccessful] = useState(false);

  // navigator is client-only; read it after mount and submit via a hidden field
  // so the registration action can persist the user's preferred language.
  const [browserLanguage, setBrowserLanguage] = useState("");

  useEffect(() => {
    setBrowserLanguage(navigator.language);
  }, []);

  const [state, formAction] = useActionState<RegisterActionState, FormData>(
    register,
    {
      status: "idle",
    }
  );

  const { update: updateSession } = useSession();

  useEffect(() => {
    if (isSuccessful) {
      return;
    }

    if (state.status === "user_exists") {
      toast({ type: "error", description: tErrors("userExists") });
      return;
    }

    if (state.status === "rate_limited") {
      toast({ type: "error", description: tErrors("tooManyAttempts") });
      return;
    }

    if (state.status === "disposable_email") {
      toast({ type: "error", description: tErrors("disposableEmail") });
      return;
    }

    if (state.status === "failed") {
      toast({ type: "error", description: tNotifications("createError") });
      return;
    }

    if (state.status === "invalid_data") {
      toast({
        type: "error",
        description: tErrors("invalidData"),
      });
      return;
    }

    if (state.status !== "success") {
      return;
    }

    setIsSuccessful(true);

    updateSession().finally(() => {
      router.replace("/chat");
    });
  }, [
    router,
    state.status,
    isSuccessful,
    tErrors,
    tNotifications,
    updateSession,
  ]);

  return (
    <AuthPageLayout>
      <AuthPageHeader subtitle={t("subtitle")} title={t("title")} />
      <AuthForm action={formAction} mode="register">
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
