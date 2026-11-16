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
import { type LoginActionState, login } from "../actions";

const CALLBACK_URL_PARAM = "callbackUrl";
const DEFAULT_REDIRECT_PATH = "/chat";

type LoginPageClientProps = {
  showSignup: boolean;
};

/**
 * Where to send the user after a successful login: the `callbackUrl` query
 * parameter when it stays on this origin, the chat otherwise.
 *
 * Browser-only (call it from an effect or an event handler). It reads
 * `window.location` instead of `useSearchParams()` on purpose: that hook
 * needs a `<Suspense>` boundary around the page, and the boundary made the
 * server stream the form into a hidden `<div hidden id="S:0">` next to a
 * loader fallback. For up to 300 ms the DOM then held that hidden copy and,
 * once the session request resolved, a second client-rendered form with the
 * same ids, and the server-rendered form was thrown away (GIPITI-229).
 */
const getRedirectPath = (): string => {
  const callbackUrl = new URLSearchParams(window.location.search).get(
    CALLBACK_URL_PARAM
  );

  if (!callbackUrl) {
    return DEFAULT_REDIRECT_PATH;
  }

  if (callbackUrl.startsWith("/")) {
    return callbackUrl;
  }

  try {
    const url = new URL(callbackUrl, window.location.origin);

    if (url.origin === window.location.origin) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch (error) {
    console.error("Error parsing callback URL:", error);
  }

  return DEFAULT_REDIRECT_PATH;
};

// No `<Suspense>` here: the form must be part of the first HTML chunk, see
// `getRedirectPath`.
export function LoginPageClient({ showSignup }: LoginPageClientProps) {
  const t = useTranslations("auth.login");
  const tErrors = useTranslations("auth.errors");
  const router = useRouter();

  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<LoginActionState, FormData>(
    login,
    {
      status: "idle",
    }
  );

  const { update: updateSession } = useSession();

  useEffect(() => {
    if (isSuccessful) {
      return;
    }

    if (state.status === "failed") {
      toast({
        type: "error",
        description: tErrors("invalidCredentials"),
      });
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

    const redirectPath = getRedirectPath();

    updateSession().then(() => {
      router.replace(redirectPath);
    });
  }, [router, state.status, updateSession, isSuccessful, tErrors]);

  return (
    <AuthPageLayout>
      <AuthPageHeader subtitle={t("subtitle")} title={t("title")} />
      <AuthForm action={formAction} mode="login">
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
