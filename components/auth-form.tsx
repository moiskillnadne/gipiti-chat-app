"use client";

import Form from "next/form";
import { useState } from "react";

import type { AuthFormErrorControls } from "@/app/(auth)/_lib/use-auth-form-error";
import { useTranslations } from "@/lib/i18n/translate";

import { FormError } from "./form-error";
import { PasswordInput } from "./password-input";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

/** DOM ids of the credential fields, for `useAuthFormError`. */
export const AUTH_FORM_FIELD_IDS = {
  email: "email-display",
  password: "password-display",
} as const;

export function AuthForm({
  action,
  children,
  defaultEmail = "",
  errorControls,
  mode = "login",
}: {
  action: NonNullable<
    string | ((formData: FormData) => void | Promise<void>) | undefined
  >;
  children: React.ReactNode;
  defaultEmail?: string;
  /** Shows the form error under the password field and marks the fields. */
  errorControls: AuthFormErrorControls;
  mode?: "login" | "register";
}) {
  const t = useTranslations(mode === "login" ? "auth.login" : "auth.register");
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const { errorId, formProps, getFieldProps, message } = errorControls;

  return (
    <Form
      action={action}
      className="flex flex-col gap-4 px-4 sm:px-16"
      {...formProps}
    >
      <div className="flex flex-col gap-2">
        <Label className="font-normal" htmlFor={AUTH_FORM_FIELD_IDS.email}>
          {t("email")}
        </Label>

        <Input
          autoComplete="email"
          autoFocus
          className="bg-muted"
          id={AUTH_FORM_FIELD_IDS.email}
          name="email-display"
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          required
          type="email"
          value={email}
          {...getFieldProps("email")}
        />

        {/* Hidden input to submit email with form */}
        <input name="email" type="hidden" value={email} />
      </div>

      <div className="flex flex-col gap-2">
        <PasswordInput
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          id={AUTH_FORM_FIELD_IDS.password}
          label={t("password")}
          name="password-display"
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("passwordPlaceholder")}
          required
          showRequirements={mode === "register"}
          value={password}
          {...getFieldProps("password")}
        />

        {/* Hidden input to submit password with form */}
        <input name="password" type="hidden" value={password} />
      </div>

      <FormError id={errorId} message={message} />

      {children}
    </Form>
  );
}
