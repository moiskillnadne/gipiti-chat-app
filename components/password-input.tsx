"use client";

import { Check, Eye, EyeOff, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ChangeEvent, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  calculatePasswordStrength,
  checkPasswordRequirement,
  type PasswordRequirement,
  passwordRequirements,
} from "@/lib/validation/password";

type PasswordInputProps = {
  id: string;
  name: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  showRequirements?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
  disabled?: boolean;
};

export function PasswordInput({
  id,
  name,
  value,
  onChange,
  placeholder,
  label,
  required = false,
  showRequirements = true,
  autoComplete = "current-password",
  autoFocus = false,
  disabled = false,
}: PasswordInputProps) {
  const t = useTranslations("auth.validation");
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const strength = calculatePasswordStrength(value);
  const shouldShowChecklist =
    showRequirements && (isFocused || value.length > 0);
  const shouldShowStrength = showRequirements && value.length > 0;

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <Label className="font-normal" htmlFor={id}>
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </Label>
      )}

      <div className="relative">
        <Input
          aria-describedby={
            showRequirements ? `${id}-requirements ${id}-strength` : undefined
          }
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          className="pr-10"
          disabled={disabled}
          id={id}
          name={name}
          onBlur={() => setIsFocused(false)}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          required={required}
          type={showPassword ? "text" : "password"}
          value={value}
        />

        <button
          aria-label={showPassword ? t("hidePassword") : t("showPassword")}
          className="-translate-y-1/2 absolute top-1/2 right-2 rounded-md p-1.5 transition-colors hover:bg-muted"
          onClick={() => setShowPassword(!showPassword)}
          tabIndex={-1}
          type="button"
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Eye className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>

      <div
        aria-hidden={!shouldShowStrength}
        aria-live="polite"
        className="overflow-hidden transition-all duration-300 ease-in-out"
        id={`${id}-strength`}
        style={{
          maxHeight: shouldShowStrength ? "60px" : "0px",
          opacity: shouldShowStrength ? 1 : 0,
        }}
      >
        <div className="space-y-1 pb-1">
          <div className="flex items-center justify-between text-base">
            <span className="text-muted-foreground">
              {t("passwordStrength")}
            </span>
            <span
              className="font-medium transition-colors duration-200"
              style={{ color: strength.color }}
            >
              {t(
                `strength${strength.label.charAt(0).toUpperCase()}${strength.label.slice(1)}`
              )}
            </span>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              aria-label="Password strength"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={strength.score}
              className="h-full rounded-full transition-all duration-300 ease-out"
              role="progressbar"
              style={{
                width: `${strength.score}%`,
                backgroundColor: strength.color,
              }}
            />
          </div>
        </div>
      </div>

      <div
        aria-hidden={!shouldShowChecklist}
        className="overflow-hidden transition-all duration-300 ease-in-out"
        id={`${id}-requirements`}
        style={{
          maxHeight: shouldShowChecklist ? "300px" : "0px",
          opacity: shouldShowChecklist ? 1 : 0,
        }}
      >
        <div className="space-y-1.5 pt-2">
          <p className="font-medium text-base text-muted-foreground">
            {t("passwordRequirements")}
          </p>

          <ul className="space-y-1 pb-1">
            {passwordRequirements.map((requirement: PasswordRequirement) => {
              const isMet = checkPasswordRequirement(value, requirement);

              return (
                <li
                  className="flex items-center gap-2 text-base transition-all duration-200"
                  key={requirement.id}
                >
                  <span
                    aria-hidden="true"
                    className={`flex-shrink-0 rounded-full p-0.5 transition-colors duration-200 ${
                      isMet
                        ? "bg-green-500 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isMet ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </span>
                  <span
                    className={`transition-colors duration-200 ${
                      isMet ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {t(requirement.id)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
