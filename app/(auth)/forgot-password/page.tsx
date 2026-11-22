"use client";

import Form from "next/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { AuthPageHeader } from "@/components/auth-page-header";
import { AuthPageLayout } from "@/components/auth-page-layout";
import { FormError } from "@/components/form-error";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/lib/i18n/translate";

import { getForgotPasswordFormError } from "../_lib/form-errors";
import { useAuthFormError } from "../_lib/use-auth-form-error";
import {
  type ForgotPasswordActionState,
  requestPasswordReset,
} from "../actions";

const EMAIL_FIELD_ID = "email";
const FORGOT_PASSWORD_FIELD_IDS = { email: EMAIL_FIELD_ID } as const;
const FORGOT_PASSWORD_ERROR_ID = "forgot-password-form-error";

// No `<Suspense>` here: the form must be part of the first HTML chunk. Under a
// boundary that suspends on the server, React streams the form into a hidden
// element next to a fallback and, when the session request resolves before
// the swap, renders a second copy on the client (GIPITI-229).
export default function Page() {
  const t = useTranslations("auth.forgotPassword");
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);
  const errorControls = useAuthFormError({
    errorId: FORGOT_PASSWORD_ERROR_ID,
    fieldIds: FORGOT_PASSWORD_FIELD_IDS,
  });

  const [state, formAction] = useActionState<
    ForgotPasswordActionState,
    FormData
  >(
    (previousState, formData) =>
      errorControls.runAction(
        () => requestPasswordReset(previousState, formData),
        getForgotPasswordFormError,
        previousState
      ),
    { status: "idle" }
  );

  useEffect(() => {
    // Failures are shown inline by `errorControls`.
    if (isSuccessful || state.status !== "success") {
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
  }, [state.status, router, t, isSuccessful]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get("email") as string);
    formAction(formData);
  };

  return (
    <AuthPageLayout>
      <AuthPageHeader subtitle={t("subtitle")} title={t("title")} />

      <Form
        action={handleSubmit}
        className="flex flex-col gap-4 px-4 sm:px-16"
        {...errorControls.formProps}
      >
        <div className="flex flex-col gap-2">
          <Label className="font-normal text-zinc-600" htmlFor={EMAIL_FIELD_ID}>
            {t("emailLabel")}
          </Label>

          <Input
            autoComplete="email"
            autoFocus
            className="bg-muted text-md md:text-sm"
            defaultValue={email}
            disabled={isSuccessful}
            id={EMAIL_FIELD_ID}
            name="email"
            placeholder={t("emailPlaceholder")}
            required
            type="email"
            {...errorControls.getFieldProps("email")}
          />
        </div>

        <FormError id={errorControls.errorId} message={errorControls.message} />

        <SubmitButton isSuccessful={isSuccessful}>{t("submit")}</SubmitButton>

        <p className="mt-4 text-center text-gray-600 text-sm">
          <Link
            className="font-semibold text-gray-800 hover:underline"
            href="/login"
          >
            {t("backToLogin")}
          </Link>
        </p>
      </Form>
    </AuthPageLayout>
  );
}
