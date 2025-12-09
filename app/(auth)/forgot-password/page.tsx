"use client";

import Form from "next/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Suspense, useActionState, useEffect, useState } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  type ForgotPasswordActionState,
  requestPasswordReset,
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
    <Suspense fallback={<ForgotPasswordPageFallback />}>
      <ForgotPasswordPage />
    </Suspense>
  );
}

function ForgotPasswordPageFallback() {
  const t = useTranslations("auth.forgotPassword");

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

function ForgotPasswordPage() {
  const t = useTranslations("auth.forgotPassword");
  const tErrors = useTranslations("auth.errors");
  const tSupport = useTranslations("legal.support");
  const router = useRouter();
  const locale = useLocale();

  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<
    ForgotPasswordActionState,
    FormData
  >(requestPasswordReset, {
    status: "idle",
  });

  useEffect(() => {
    if (isSuccessful) {
      return;
    }

    if (state.status === "failed") {
      toast({
        type: "error",
        description: tErrors("emailSendFailed"),
      });
      return;
    }

    if (state.status === "rate_limited") {
      toast({
        type: "error",
        description: state.resetMinutes
          ? `${tErrors("rateLimitExceeded")} (${state.resetMinutes}min)`
          : tErrors("rateLimitExceeded"),
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

    // Redirect to login after 3 seconds
    setTimeout(() => {
      router.push("/login");
    }, 3000);
  }, [state.status, state.resetMinutes, router, t, tErrors, isSuccessful]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get("email") as string);
    formData.append("locale", locale);
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

        <Form
          action={handleSubmit}
          className="flex flex-col gap-4 px-4 sm:px-16"
        >
          <div className="flex flex-col gap-2">
            <Label
              className="font-normal text-zinc-600 dark:text-zinc-400"
              htmlFor="email"
            >
              {t("emailLabel")}
            </Label>

            <Input
              autoComplete="email"
              autoFocus
              className="bg-muted text-md md:text-sm"
              defaultValue={email}
              disabled={isSuccessful}
              id="email"
              name="email"
              placeholder={t("emailPlaceholder")}
              required
              type="email"
            />
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
      <SupportLink linkText={tSupport("linkText")} text={tSupport("needHelp")} />
    </div>
  );
}
