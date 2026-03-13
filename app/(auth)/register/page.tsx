"use client";

import { SmartCaptcha } from "@yandex/smart-captcha";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Suspense, useActionState, useEffect, useState } from "react";

import { AuthForm } from "@/components/auth-form";
import { AuthPageHeader } from "@/components/auth-page-header";
import { AuthPageLayout } from "@/components/auth-page-layout";
import { Loader } from "@/components/elements/loader";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { type RegisterActionState, register } from "../actions";

const CAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_YANDEX_SMARTCAPTCHA_SITE_KEY;

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
    <AuthPageLayout>
      <AuthPageHeader subtitle={t("subtitle")} title={t("title")} />
      <Loader size={30} />
    </AuthPageLayout>
  );
}

function RegisterPage() {
  const locale = useLocale();
  const t = useTranslations("auth.register");
  const tErrors = useTranslations("auth.errors");
  const tNotifications = useTranslations("common.notifications");
  const router = useRouter();

  const [isSuccessful, setIsSuccessful] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);

  const [state, formAction] = useActionState<RegisterActionState, FormData>(
    register,
    {
      status: "idle",
    }
  );

  const { update: updateSession } = useSession();

  const isCaptchaEnabled = !!CAPTCHA_SITE_KEY;
  const isCaptchaCompleted = !isCaptchaEnabled || !!captchaToken;

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

    if (state.status === "captcha_failed") {
      toast({ type: "error", description: tErrors("captchaFailed") });
      setCaptchaToken("");
      setCaptchaKey((prev) => prev + 1);
      return;
    }

    if (state.status !== "success") {
      return;
    }

    toast({ type: "success", description: tNotifications("verificationSent") });

    setIsSuccessful(true);

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
    <AuthPageLayout>
      <AuthPageHeader subtitle={t("subtitle")} title={t("title")} />
      <AuthForm action={formAction} mode="register">
        <input name="locale" type="hidden" value={locale} />
        <input name="captcha-token" type="hidden" value={captchaToken} />
        {isCaptchaEnabled && (
          <SmartCaptcha
            key={captchaKey}
            language={locale === "ru" ? "ru" : "en"}
            onSuccess={setCaptchaToken}
            onTokenExpired={() => setCaptchaToken("")}
            sitekey={CAPTCHA_SITE_KEY}
          />
        )}
        <SubmitButton
          isDisabled={!isCaptchaCompleted}
          isSuccessful={isSuccessful}
        >
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
    </AuthPageLayout>
  );
}
