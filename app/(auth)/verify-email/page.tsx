"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import {
  Suspense,
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  type ResendVerificationActionState,
  resendVerificationCode,
  type VerifyEmailActionState,
  verifyEmail,
} from "../actions";

function SupportLink({ text, linkText }: { text: string; linkText: string }) {
  return (
    <p className="fixed bottom-4 right-4 z-50 text-gray-500 text-xs dark:text-zinc-500">
      {text}{" "}
      <Link className="hover:underline" href="/legal/support">
        {linkText}
      </Link>
    </p>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<VerifyEmailPageFallback />}>
      <VerifyEmailPage />
    </Suspense>
  );
}

function VerifyEmailPageFallback() {
  const t = useTranslations("auth.verification");

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

function VerifyEmailPage() {
  const locale = useLocale();
  const t = useTranslations("auth.verification");
  const tErrors = useTranslations("auth.errors");
  const tNotifications = useTranslations("common.notifications");
  const tNav = useTranslations("common.navigation");
  const tSupport = useTranslations("legal.support");
  const router = useRouter();
  const { data: session, status, update: updateSession } = useSession();

  const email = session?.user?.email || "";
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const hasHandledSuccess = useRef(false);

  const [verifyState, verifyAction] = useActionState<
    VerifyEmailActionState,
    FormData
  >(verifyEmail, {
    status: "idle",
  });

  const [resendState, resendAction] = useActionState<
    ResendVerificationActionState,
    FormData
  >(resendVerificationCode, {
    status: "idle",
  });

  const handleSessionUpdate = useCallback(async () => {
    const updatedSession = await updateSession({ emailVerified: true });
    console.log("Updated session", updatedSession);
    router.replace("/");
  }, [updateSession, router]);

  // Handle cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Handle verification result
  useEffect(() => {
    if (verifyState.status === "invalid_code") {
      toast({ type: "error", description: tErrors("invalidCode") });
      return;
    }

    if (verifyState.status === "expired_code") {
      toast({ type: "error", description: tErrors("expiredCode") });
      return;
    }

    if (verifyState.status === "failed") {
      toast({ type: "error", description: tNotifications("genericError") });
      return;
    }

    if (verifyState.status === "invalid_data") {
      toast({ type: "error", description: tErrors("invalidData") });
      return;
    }

    if (verifyState.status === "success" && !hasHandledSuccess.current) {
      hasHandledSuccess.current = true;
      toast({ type: "success", description: t("success") });

      handleSessionUpdate();
      return;
    }
  }, [verifyState.status, t, tErrors, tNotifications, handleSessionUpdate]);

  // Handle resend result
  useEffect(() => {
    if (resendState.status === "rate_limited") {
      setCooldown(resendState.cooldownSeconds || 60);
      toast({ type: "error", description: t("rateLimited") });
      return;
    }

    if (resendState.status === "failed") {
      toast({ type: "error", description: tNotifications("genericError") });
      return;
    }

    if (resendState.status === "success") {
      setCooldown(60);
      toast({ type: "success", description: t("codeSent") });
    }
  }, [resendState.status, resendState.cooldownSeconds, t, tNotifications]);

  const handleVerify = useCallback(
    (formData: FormData) => {
      formData.set("email", email);
      formData.set("code", code);
      verifyAction(formData);
    },
    [email, code, verifyAction]
  );

  const handleResend = useCallback(() => {
    if (cooldown > 0) {
      return;
    }

    const formData = new FormData();
    formData.set("email", email);
    formData.set("locale", locale);
    startTransition(() => {
      resendAction(formData);
    });
  }, [email, locale, cooldown, resendAction]);

  const handleCodeComplete = useCallback(
    (value: string) => {
      setCode(value);
      if (value.length === 6) {
        const formData = new FormData();
        formData.set("email", email);
        formData.set("code", value);
        startTransition(() => {
          verifyAction(formData);
        });
      }
    },
    [email, verifyAction]
  );

  // Show loading state while session is being fetched
  if (status === "loading") {
    return <VerifyEmailPageFallback />;
  }

  if (!email) {
    return (
      <div className="flex h-dvh w-screen items-start justify-center bg-background pt-12 md:items-center md:pt-0">
        <div className="flex w-full max-w-md flex-col gap-12 overflow-hidden rounded-2xl">
          <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
            <h3 className="font-semibold text-2xl dark:text-zinc-50">
              {t("title")}
            </h3>
            <p className="text-gray-500 text-sm dark:text-zinc-400">
              {t("noEmail")}
            </p>
            <Link
              className="mt-4 font-semibold text-gray-800 hover:underline dark:text-zinc-200"
              href="/register"
            >
              {t("backToRegister")}
            </Link>
          </div>
        </div>
        <div className="fixed bottom-4 left-4 z-50">
          <LanguageSwitcher />
        </div>
        <SupportLink linkText={tSupport("linkText")} text={tSupport("needHelp")} />
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-screen items-start justify-center bg-background pt-12 md:items-center md:pt-0">
      <div className="flex w-full max-w-md flex-col gap-8 overflow-hidden rounded-2xl">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="font-semibold text-2xl dark:text-zinc-50">
            {t("title")}
          </h3>
          <p className="text-gray-500 text-sm dark:text-zinc-400">
            {t("subtitle")}
          </p>
          <p className="mt-2 text-muted-foreground text-sm">
            {t("sentTo")} <strong>{email}</strong>
          </p>
        </div>

        <form
          action={handleVerify}
          className="flex flex-col items-center gap-6 px-4 sm:px-16"
        >
          <InputOTP
            disabled={verifyState.status === "in_progress"}
            maxLength={6}
            onChange={setCode}
            onComplete={handleCodeComplete}
            value={code}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>

          <SubmitButton isSuccessful={verifyState.status === "success"}>
            {t("verifyButton")}
          </SubmitButton>
        </form>

        <div className="flex flex-col items-center gap-4 px-4 sm:px-16">
          <p className="text-muted-foreground text-sm">{t("noCode")}</p>
          <Button
            className="w-full"
            disabled={cooldown > 0 || resendState.status === "in_progress"}
            onClick={handleResend}
            variant="outline"
          >
            {cooldown > 0 ? t("cooldown", { seconds: cooldown }) : t("resend")}
          </Button>

          <button
            className="mt-2 font-semibold text-gray-800 hover:underline dark:text-zinc-200"
            onClick={() => signOut({ callbackUrl: "/login" })}
            type="button"
          >
            {tNav("signOut")}
          </button>
        </div>
      </div>
      <div className="fixed bottom-4 left-4 z-50">
        <LanguageSwitcher />
      </div>
      <SupportLink linkText={tSupport("linkText")} text={tSupport("needHelp")} />
    </div>
  );
}
