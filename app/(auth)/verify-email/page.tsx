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

import { AuthPageHeader } from "@/components/auth-page-header";
import { AuthPageLayout } from "@/components/auth-page-layout";
import { Loader } from "@/components/elements/loader";
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
    <AuthPageLayout>
      <AuthPageHeader subtitle={t("subtitle")} title={t("title")} />
      <Loader size={30} />
    </AuthPageLayout>
  );
}

function VerifyEmailPage() {
  const locale = useLocale();
  const t = useTranslations("auth.verification");
  const tErrors = useTranslations("auth.errors");
  const tNotifications = useTranslations("common.notifications");
  const tNav = useTranslations("common.navigation");
  const router = useRouter();
  const { data: session, status, update: updateSession } = useSession();

  const email = session?.user?.email || "";
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [isUpdatingSession, setIsUpdatingSession] = useState(false);
  const hasHandledSuccess = useRef(false);

  const [verifyState, verifyAction] = useActionState<
    VerifyEmailActionState,
    FormData
  >(verifyEmail, { status: "idle" });

  const [resendState, resendAction] = useActionState<
    ResendVerificationActionState,
    FormData
  >(resendVerificationCode, { status: "idle" });

  const handleSessionUpdate = useCallback(async () => {
    setIsUpdatingSession(true);
    try {
      const updatedSession = await updateSession({ emailVerified: true });
      console.log("Session update result:", updatedSession);

      if (!updatedSession?.user?.emailVerified) {
        console.warn(
          "Session update did not reflect emailVerified change, redirecting anyway"
        );
        setTimeout(() => {
          setIsUpdatingSession(false);
          router.replace("/chat");
        }, 1500);
      }
    } catch (error) {
      console.error("Session update failed:", error);
      setIsUpdatingSession(false);
      setTimeout(() => router.replace("/chat"), 1000);
    }
  }, [updateSession, router]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  useEffect(() => {
    if (session?.user?.emailVerified && !hasHandledSuccess.current) {
      hasHandledSuccess.current = true;
      console.log("Session emailVerified detected, redirecting to /chat");
      setIsUpdatingSession(false);
      router.replace("/chat");
    }
  }, [session?.user?.emailVerified, router]);

  useEffect(() => {
    if (isUpdatingSession) {
      const timeout = setTimeout(() => {
        console.warn("Session update timeout - redirecting anyway");
        setIsUpdatingSession(false);
        router.replace("/chat");
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [isUpdatingSession, router]);

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

    if (
      verifyState.status === "already_verified" &&
      !hasHandledSuccess.current
    ) {
      hasHandledSuccess.current = true;
      toast({ type: "success", description: t("alreadyVerified") });
      router.replace("/chat");
      return;
    }

    if (verifyState.status === "success" && !hasHandledSuccess.current) {
      hasHandledSuccess.current = true;
      toast({ type: "success", description: t("success") });
      handleSessionUpdate();
    }
  }, [
    verifyState.status,
    t,
    tErrors,
    tNotifications,
    handleSessionUpdate,
    router,
  ]);

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

  if (status === "loading") {
    return <VerifyEmailPageFallback />;
  }

  if (!email) {
    return (
      <AuthPageLayout>
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
      </AuthPageLayout>
    );
  }

  console.log("verifyState", verifyState);

  return (
    <AuthPageLayout>
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
          disabled={verifyState.status === "in_progress" || isUpdatingSession}
          maxLength={6}
          onChange={setCode}
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
          disabled={
            cooldown > 0 ||
            resendState.status === "in_progress" ||
            isUpdatingSession
          }
          onClick={handleResend}
          variant="outline"
        >
          {cooldown > 0 ? t("cooldown", { seconds: cooldown }) : t("resend")}
        </Button>

        <button
          className="mt-2 font-semibold text-gray-800 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200"
          disabled={isUpdatingSession}
          onClick={() => signOut({ callbackUrl: "/login" })}
          type="button"
        >
          {tNav("signOut")}
        </button>
      </div>
    </AuthPageLayout>
  );
}
