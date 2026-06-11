"use client";

import { useCallback, useState } from "react";

import {
  TOPUP_MAX_MAJOR_UNITS,
  TOPUP_MIN_MAJOR_UNITS,
} from "@/lib/billing/constants";

const MAX_INPUT_DIGITS = 6;

export type TopupAmountError = "min" | "max" | null;

export type TopupAmount = {
  /** Parsed integer amount in MAJOR units (rubles); 0 when the input is empty. */
  value: number;
  /** Grouped display string ("1 000"), empty when the input is empty. */
  display: string;
  error: TopupAmountError;
  isValid: boolean;
  set: (raw: string | number) => void;
};

/**
 * Amount state for the top-up dialog: digits-only input bounded by the
 * product limits. Mirrors the server-side Zod validation. The minimum is
 * caller-supplied — testers are allowed below the public minimum.
 */
export function useTopupAmount(
  initial = 1000,
  minMajorUnits: number = TOPUP_MIN_MAJOR_UNITS
): TopupAmount {
  const [raw, setRaw] = useState<string>(String(initial));

  const value = Number.parseInt(raw.replace(/\D/g, ""), 10) || 0;

  let error: TopupAmountError = null;
  if (value !== 0 && value < minMajorUnits) {
    error = "min";
  } else if (value > TOPUP_MAX_MAJOR_UNITS) {
    error = "max";
  }

  const isValid = value >= minMajorUnits && value <= TOPUP_MAX_MAJOR_UNITS;

  const set = useCallback((next: string | number) => {
    setRaw(String(next).replace(/\D/g, "").slice(0, MAX_INPUT_DIGITS));
  }, []);

  return {
    value,
    display: value ? value.toLocaleString("ru-RU") : "",
    error,
    isValid,
    set,
  };
}

/**
 * Format a MAJOR-unit ruble amount the way the design does: "1 000 ₽".
 */
export function formatRubMajor(amount: number): string {
  return `${amount.toLocaleString("ru-RU")} ₽`;
}
