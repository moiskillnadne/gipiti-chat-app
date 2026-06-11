"use client";

import { useState } from "react";
import { useTranslations } from "@/lib/i18n/translate";
import type { BalanceViewState } from "@/lib/subscription/subscription-state";
import dash from "./dashboard.module.css";
import { PlusIcon } from "./icons";
import { TopUpDialog } from "./top-up-dialog";

type TopUpButtonProps = {
  state: BalanceViewState;
};

/**
 * Entry point for one-time top-ups. Rendered only inside the plan card, so it
 * inherits the card's paid-state visibility (active/low/cancelled/past_due).
 * Outline style in past_due so it doesn't compete with "update card".
 */
export function TopUpButton({ state }: TopUpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations("auth.subscription.balance.topup");

  const variantClass = state === "past_due" ? dash.btnOutline : dash.btnPrimary;

  return (
    <>
      <button
        className={`${dash.btn} ${variantClass} ${dash.btnSm}`}
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <PlusIcon />
        {t("button")}
      </button>
      <TopUpDialog isOpen={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
