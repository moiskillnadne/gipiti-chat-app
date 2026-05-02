"use client";

import { useFormStatus } from "react-dom";
import { LoaderIcon } from "@/components/icons";
import { useTranslations } from "@/lib/i18n/translate";

import { Button } from "./ui/button";

export function SubmitButton({
  children,
  isDisabled = false,
  isSuccessful,
}: {
  children: React.ReactNode;
  isDisabled?: boolean;
  isSuccessful: boolean;
}) {
  const t = useTranslations("common.accessibility");
  const { pending } = useFormStatus();

  const isButtonDisabled = pending || isSuccessful || isDisabled;

  return (
    <Button
      aria-disabled={isButtonDisabled}
      className="relative"
      disabled={isButtonDisabled}
      type={pending ? "button" : "submit"}
    >
      {children}

      {(pending || isSuccessful) && (
        <span className="absolute right-4 animate-spin">
          <LoaderIcon />
        </span>
      )}

      <output aria-live="polite" className="sr-only">
        {pending || isSuccessful ? t("loading") : t("submitForm")}
      </output>
    </Button>
  );
}
