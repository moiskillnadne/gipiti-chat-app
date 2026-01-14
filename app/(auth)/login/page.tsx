"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import {
  Suspense,
  useActionState,
  useCallback,
  useEffect,
  useState,
} from "react";

import { AuthForm } from "@/components/auth-form";
import { AuthPageHeader } from "@/components/auth-page-header";
import { AuthPageLayout } from "@/components/auth-page-layout";
import { Loader } from "@/components/elements/loader";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { type LoginActionState, login } from "../actions";

export default function Page() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPage />
    </Suspense>
  );
}

function LoginPageFallback() {
  const t = useTranslations("auth.login");

  return (
    <AuthPageLayout>
      <AuthPageHeader subtitle={t("subtitle")} title={t("title")} />
      <Loader size={30} />
    </AuthPageLayout>
  );
}

function LoginPage() {
  const t = useTranslations("auth.login");
  const tErrors = useTranslations("auth.errors");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<LoginActionState, FormData>(
    login,
    {
      status: "idle",
    }
  );

  const { update: updateSession } = useSession();

  const getRedirectPath = useCallback(() => {
    const callbackUrl = searchParams?.get("callbackUrl");

    if (!callbackUrl) {
      return "/chat";
    }

    if (callbackUrl.startsWith("/")) {
      return callbackUrl;
    }

    if (typeof window !== "undefined") {
      try {
        const url = new URL(callbackUrl, window.location.origin);

        if (url.origin === window.location.origin) {
          return `${url.pathname}${url.search}${url.hash}`;
        }
      } catch (error) {
        console.error("Error parsing callback URL:", error);
        return "/chat";
      }
    }

    return "/chat";
  }, [searchParams]);

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
  }, [
    getRedirectPath,
    router,
    state.status,
    updateSession,
    isSuccessful,
    tErrors,
  ]);

  return (
    <AuthPageLayout>
      <AuthPageHeader subtitle={t("subtitle")} title={t("title")} />
      <AuthForm action={formAction} mode="login">
        <div className="flex items-center justify-end">
          <Link
            className="text-gray-600 text-sm hover:underline dark:text-zinc-400"
            href="/forgot-password"
          >
            {t("forgotPasswordLink")}
          </Link>
        </div>
        <SubmitButton isSuccessful={isSuccessful}>
          {t("signInButton")}
        </SubmitButton>
        <p className="mt-4 text-center text-gray-600 text-sm dark:text-zinc-400">
          {t("noAccount")}{" "}
          <Link
            className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
            href="/register"
          >
            {t("signUpLink")}
          </Link>{" "}
          {t("signUpLinkSuffix")}
        </p>
      </AuthForm>
    </AuthPageLayout>
  );
}
