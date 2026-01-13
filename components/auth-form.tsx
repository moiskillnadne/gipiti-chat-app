"use client";

import Form from "next/form";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PasswordInput } from "./password-input";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function AuthForm({
  action,
  children,
  defaultEmail = "",
  mode = "login",
}: {
  action: NonNullable<
    string | ((formData: FormData) => void | Promise<void>) | undefined
  >;
  children: React.ReactNode;
  defaultEmail?: string;
  mode?: "login" | "register";
}) {
  const t = useTranslations(mode === "login" ? "auth.login" : "auth.register");
  const [password, setPassword] = useState("");

  return (
    <Form action={action} className="flex flex-col gap-4 px-4 sm:px-16">
      <div className="flex flex-col gap-2">
        <Label
          className="font-normal text-zinc-600 dark:text-zinc-400"
          htmlFor="email"
        >
          {t("email")}
        </Label>

        <Input
          autoComplete="email"
          autoFocus
          className="bg-muted"
          defaultValue={defaultEmail}
          id="email"
          name="email"
          placeholder={t("emailPlaceholder")}
          required
          type="email"
        />
      </div>

      <div className="flex flex-col gap-2">
        <PasswordInput
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          id="password-display"
          label={t("password")}
          name="password-display"
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("passwordPlaceholder")}
          required
          showRequirements={mode === "register"}
          value={password}
        />

        {/* Hidden input to submit password with form */}
        <input name="password" type="hidden" value={password} />
      </div>

      {children}
    </Form>
  );
}
