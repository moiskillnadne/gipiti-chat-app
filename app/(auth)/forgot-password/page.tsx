"use client";

import Form from "next/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Suspense, useActionState, useEffect, useState } from "react";

import { AuthPageHeader } from "@/components/auth-page-header";
import { AuthPageLayout } from "@/components/auth-page-layout";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  type ForgotPasswordActionState,
  requestPasswordReset,
} from "../actions";

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
    <AuthPageLayout>
      <AuthPageHeader subtitle={t("subtitle")} title={t("title")} />
    </AuthPageLayout>
  );
}

function ForgotPasswordPage() {
  const t = useTranslations("auth.forgotPassword");
  const tErrors = useTranslations("auth.errors");
  const router = useRouter();
  const locale = useLocale();

  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<
    ForgotPasswordActionState,
    FormData
  >(requestPasswordReset, { status: "idle" });

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
    <AuthPageLayout>
      <AuthPageHeader subtitle={t("subtitle")} title={t("title")} />

      <Form action={handleSubmit} className="flex flex-col gap-4 px-4 sm:px-16">
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
    </AuthPageLayout>
  );
}
