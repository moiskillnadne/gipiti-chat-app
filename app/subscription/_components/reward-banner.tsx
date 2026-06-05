"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import {
  type ResendVerificationActionState,
  resendVerificationCode,
} from "@/app/(auth)/actions";
import { toast } from "@/components/toast";
import { useTranslations } from "@/lib/i18n/translate";
import styles from "./dashboard.module.css";
import { GiftIcon } from "./icons";

const VERIFY_EMAIL_PATH = "/subscription/verify-email";

export type RewardBannerProps = {
  email: string;
  bonusAmount: string;
};

const INITIAL_STATE: ResendVerificationActionState = { status: "idle" };

export function RewardBanner({ email, bonusAmount }: RewardBannerProps) {
  const t = useTranslations("auth.subscription.balance.banner.reward");
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    resendVerificationCode,
    INITIAL_STATE
  );
  const lastHandledStatus =
    useRef<ResendVerificationActionState["status"]>("idle");

  useEffect(() => {
    if (state.status === lastHandledStatus.current) {
      return;
    }
    lastHandledStatus.current = state.status;

    // The code was just sent (or was sent very recently) — take the user to the
    // confirmation page where they enter the 6-digit code.
    if (state.status === "success" || state.status === "rate_limited") {
      router.push(VERIFY_EMAIL_PATH);
      return;
    }

    if (state.status === "failed" || state.status === "invalid_data") {
      toast({ type: "error", description: t("sendError") });
    }
  }, [state.status, router, t]);

  return (
    <div className={`${styles.banner} ${styles.bannerReward}`}>
      <span className={styles.rewardGift}>
        <GiftIcon />
      </span>

      <div className={styles.bannerBody}>
        <b>
          {t("title")}
          <span className={styles.rewardAmount}>
            {t("amount", { amount: bonusAmount })}
          </span>
        </b>
        <span>{t("body")}</span>
      </div>

      <form action={formAction} className={styles.bannerActions}>
        <input name="email" type="hidden" value={email} />
        <button
          className={`${styles.btn} ${styles.btnReward} ${styles.btnSm}`}
          disabled={isPending}
          type="submit"
        >
          {t("action")}
        </button>
      </form>
    </div>
  );
}
