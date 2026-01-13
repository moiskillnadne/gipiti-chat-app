"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Suspense, useActionState, useEffect, useState } from "react";
import { AuthForm } from "@/components/auth-form";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { type RegisterActionState, register } from "../actions";

function SupportLink({ text, linkText }: { text: string; linkText: string }) {
  return (
    <p className="fixed right-4 bottom-4 z-50 text-gray-500 text-xs dark:text-zinc-500">
      {text}{" "}
      <Link className="hover:underline" href="/legal/support">
        {linkText}
      </Link>
    </p>
  );
}

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
  const locale = useLocale();
  const t = useTranslations("auth.register");
  const tErrors = useTranslations("auth.errors");
  const tNotifications = useTranslations("common.notifications");
  const tSupport = useTranslations("legal.support");
  const router = useRouter();

  const [isSuccessful, setIsSuccessful] = useState(false);

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

    toast({ type: "success", description: tNotifications("verificationSent") });

    setIsSuccessful(true);

    // Update session and redirect to home (middleware will redirect to verify-email)
    updateSession().finally(() => {
      router.replace("/verify-email");
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
        <AuthForm action={formAction} mode="register">
          <input name="locale" type="hidden" value={locale} />
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
      <SupportLink
        linkText={tSupport("linkText")}
        text={tSupport("needHelp")}
      />
    </div>
  );
}
