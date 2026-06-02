"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  type ResendVerificationActionState,
  resendVerificationCode,
} from "@/app/(auth)/actions";
import { toast } from "@/components/toast";
import { useTranslations } from "@/lib/i18n/translate";
import styles from "./dashboard.module.css";
import { GiftIcon } from "./icons";

export type RewardBannerProps = {
  email: string;
  bonusAmount: string;
};

const INITIAL_STATE: ResendVerificationActionState = { status: "idle" };

export function RewardBanner({ email, bonusAmount }: RewardBannerProps) {
  const t = useTranslations("auth.subscription.balance.banner.reward");
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

    if (state.status === "success") {
      toast({ type: "success", description: t("sent") });
      return;
    }

    if (state.status === "rate_limited") {
      toast({ type: "error", description: t("cooldown") });
      return;
    }

    if (state.status === "failed" || state.status === "invalid_data") {
      toast({ type: "error", description: t("sendError") });
    }
  }, [state.status, t]);

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
