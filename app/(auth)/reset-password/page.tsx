"use client";

import Form from "next/form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Suspense, useActionState, useEffect, useState } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";

import { type ResetPasswordActionState, resetPassword } from "../actions";

export default function Page() {
  return (
    <Suspense fallback={<ResetPasswordPageFallback />}>
      <ResetPasswordPage />
    </Suspense>
  );
}

function ResetPasswordPageFallback() {
  const t = useTranslations("auth.resetPassword");

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

function ResetPasswordPage() {
  const t = useTranslations("auth.resetPassword");
  const tErrors = useTranslations("auth.errors");
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();

  const token = searchParams?.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [passwordMismatch, setPasswordMismatch] = useState(false);

  const [state, formAction] = useActionState<
    ResetPasswordActionState,
    FormData
  >(resetPassword, {
    status: "idle",
  });

  useEffect(() => {
    if (isSuccessful) {
      return;
    }

    if (state.status === "failed") {
      toast({
        type: "error",
        description: tErrors("resetFailed"),
      });
      return;
    }

    if (state.status === "invalid_token") {
      toast({
        type: "error",
        description: t("invalidToken"),
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

    toast({
      type: "success",
      description: t("success"),
    });

    // Redirect to login after 2 seconds
    setTimeout(() => {
      router.push("/login");
    }, 2000);
  }, [state.status, router, t, tErrors, isSuccessful]);

  const handleSubmit = (formData: FormData) => {
    // Check password match
    if (password !== confirmPassword) {
      setPasswordMismatch(true);
      toast({
        type: "error",
        description: t("passwordMismatch"),
      });
      return;
    }

    setPasswordMismatch(false);
    formData.append("token", token);
    formData.append("locale", locale);
    formAction(formData);
  };

  // Show error if no token in URL
  if (!token) {
    return (
      <div className="flex h-dvh w-screen items-start justify-center bg-background pt-12 md:items-center md:pt-0">
        <div className="flex w-full max-w-md flex-col gap-12 overflow-hidden rounded-2xl">
          <div className="flex flex-col items-center justify-center gap-6 px-4 text-center sm:px-16">
            <h3 className="font-semibold text-2xl dark:text-zinc-50">
              {t("invalidToken")}
            </h3>
            <p className="text-gray-500 text-sm dark:text-zinc-400">
              {t("invalidTokenMessage")}
            </p>
            <Link
              className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
              href="/forgot-password"
            >
              {t("requestNewLink")}
            </Link>
          </div>
        </div>
        <div className="fixed bottom-4 left-4 z-50">
          <LanguageSwitcher />
        </div>
      </div>
    );
  }

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

        <Form
          action={handleSubmit}
          className="flex flex-col gap-4 px-4 sm:px-16"
        >
          <div className="flex flex-col gap-2">
            <PasswordInput
              autoComplete="new-password"
              autoFocus
              disabled={isSuccessful}
              id="password-display"
              label={t("passwordLabel")}
              name="password-display"
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("passwordPlaceholder")}
              required
              showRequirements
              value={password}
            />
            {/* Hidden input to submit password with form */}
            <input name="password" type="hidden" value={password} />
          </div>

          <div className="flex flex-col gap-2">
            <PasswordInput
              autoComplete="new-password"
              disabled={isSuccessful}
              id="confirm-password"
              label={t("confirmLabel")}
              name="confirm-password"
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("confirmPlaceholder")}
              required
              showRequirements={false}
              value={confirmPassword}
            />

            {/* Password match indicator */}
            {confirmPassword && (
              <div className="flex items-center gap-2 text-sm">
                {password === confirmPassword ? (
                  <>
                    <svg
                      aria-hidden="true"
                      className="size-4 text-green-600 dark:text-green-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M5 13l4 4L19 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-green-600 dark:text-green-400">
                      {t("passwordMatches")}
                    </span>
                  </>
                ) : (
                  <>
                    <svg
                      aria-hidden="true"
                      className="size-4 text-red-600 dark:text-red-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M6 18L18 6M6 6l12 12"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-red-600 dark:text-red-400">
                      {t("passwordMismatch")}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <SubmitButton isSuccessful={isSuccessful}>{t("submit")}</SubmitButton>

          <p className="mt-4 text-center text-gray-600 text-sm dark:text-zinc-400">
            <Link
              className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
              href="/login"
            >
              {t("backToLogin")}
            </Link>
          </p>
        </Form>
      </div>

      <div className="fixed bottom-4 left-4 z-50">
        <LanguageSwitcher />
      </div>
    </div>
  );
}
