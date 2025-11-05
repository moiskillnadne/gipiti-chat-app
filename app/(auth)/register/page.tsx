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
import { LanguageSwitcher } from "@/components/language-switcher";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { type RegisterActionState, register } from "../actions";

export default function Page() {
  return (
    <Suspense fallback={<RegisterPageFallback />}>
      <RegisterPage />
    </Suspense>
  );
}

function RegisterPageFallback() {
  const t = useTranslations("auth.register");

  return (
    <div className="flex h-dvh w-screen items-start justify-center bg-background pt-12 md:items-center md:pt-0">
      <div className="flex w-full max-w-md flex-col gap-12 overflow-hidden rounded-2xl">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="font-semibold text-xl dark:text-zinc-50">
            {t("title")}
          </h3>
          <p className="text-gray-500 text-sm dark:text-zinc-400">
            {t("subtitle")}
          </p>
        </div>
      </div>
    </div>
  );
}

function RegisterPage() {
  const t = useTranslations("auth.register");
  const tErrors = useTranslations("auth.errors");
  const tNotifications = useTranslations("common.notifications");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<RegisterActionState, FormData>(
    register,
    {
      status: "idle",
    }
  );

  const { update: updateSession } = useSession();

  const getRedirectPath = useCallback(() => {
    const callbackUrl = searchParams?.get("callbackUrl");

    if (!callbackUrl) {
      return "/";
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
        return "/";
      }
    }

    return "/";
  }, [searchParams]);

  useEffect(() => {
    if (isSuccessful) {
      return;
    }

    if (state.status === "user_exists") {
      toast({ type: "error", description: tErrors("userExists") });
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

    toast({ type: "success", description: tNotifications("createSuccess") });

    setIsSuccessful(true);

    const redirectPath = getRedirectPath();

    updateSession().finally(() => {
      router.replace(redirectPath);
    });
  }, [
    getRedirectPath,
    router,
    state.status,
    updateSession,
    isSuccessful,
    tErrors,
    tNotifications,
  ]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get("email") as string);
    formAction(formData);
  };

  return (
    <div className="flex h-dvh w-screen items-start justify-center bg-background pt-12 md:items-center md:pt-0">
      <div className="flex w-full max-w-md flex-col gap-12 overflow-hidden rounded-2xl">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="font-semibold text-2xl dark:text-zinc-50">
            {t("title")}
          </h3>
          <p className="text-gray-500 text-sm dark:text-zinc-400">
            {t("subtitle")}
          </p>
        </div>
        <AuthForm action={handleSubmit} defaultEmail={email} mode="register">
          <SubmitButton isSuccessful={isSuccessful}>
            {t("signUpButton")}
          </SubmitButton>
          <p className="mt-4 text-center text-gray-600 text-sm dark:text-zinc-400">
            {t("hasAccount")}{" "}
            <Link
              className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
              href="/login"
            >
              {t("signInLink")}
            </Link>
          </p>
        </AuthForm>
      </div>
      <div className="fixed bottom-4 left-4 z-50">
        <LanguageSwitcher />
      </div>
    </div>
  );
}
