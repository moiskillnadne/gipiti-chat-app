"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect } from "react";
import {
  type ResendVerificationActionState,
  resendVerificationCode,
} from "@/app/(auth)/actions";
import { Loader } from "@/components/elements/loader";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/translate";
import styles from "./dashboard.module.css";
import { GiftIcon, MailIcon } from "./icons";

type FreePlanCardProps = {
  email: string;
  emailVerified: boolean;
  tokenBonus: number;
};

export function FreePlanCard({
  email,
  emailVerified,
  tokenBonus,
}: FreePlanCardProps) {
  const router = useRouter();
  const t = useTranslations("auth.subscription.dashboard.plan");
  const tCycle = useTranslations("auth.subscription.dashboard.cycle");
  const tFree = useTranslations("auth.subscription.dashboard.plan.free");
  const tNotifications = useTranslations("common.notifications");
  const tVerification = useTranslations("auth.verification");

  const [resendState, resendAction] = useActionState<
    ResendVerificationActionState,
    FormData
  >(resendVerificationCode, { status: "idle" });

  const isSending = resendState.status === "in_progress";

  useEffect(() => {
    if (resendState.status === "success") {
      toast({ type: "success", description: tVerification("codeSent") });
      router.push("/subscription/confirm-email");
      return;
    }
    if (resendState.status === "rate_limited") {
      toast({ type: "error", description: tVerification("rateLimited") });
      return;
    }
    if (
      resendState.status === "failed" ||
      resendState.status === "invalid_data"
    ) {
      toast({ type: "error", description: tNotifications("genericError") });
    }
  }, [resendState.status, router, tNotifications, tVerification]);

  const bonusAmount = Math.round(tokenBonus / 1000);

  const handleClick = () => {
    if (emailVerified) {
      router.push("/manage-subscription");
      return;
    }

    const formData = new FormData();
    formData.set("email", email);
    startTransition(() => {
      resendAction(formData);
    });
  };

  return (
    <section aria-label={t("title")} className={styles.card}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{t("title")}</h3>
        {emailVerified ? null : (
          <span className={`${styles.cardBadge} ${styles.cardBadgeWarn}`}>
            {t("badge.unverified")}
          </span>
        )}
      </div>

      <div className={styles.planRow}>
        <span className={styles.planNm}>
          {tFree("name")}
          <em className={styles.planNmEm}>{tFree("nameEm")}</em>
        </span>
        <span className={styles.planPr}>
          {t("priceLabel")}
          <b>0 ₽</b>
        </span>
      </div>

      <div className={styles.planMeta}>
        <div>
          <div className={styles.planMetaK}>{t("meta.period")}</div>
          <div className={styles.planMetaV}>{tCycle("lifetimeValue")}</div>
        </div>
        <div>
          <div className={styles.planMetaK}>{tFree("resetLabel")}</div>
          <div className={styles.planMetaV}>{tFree("resetValueNone")}</div>
        </div>
        <div>
          <div className={styles.planMetaK}>{tFree("emailLabel")}</div>
          <div
            className={`${styles.planMetaV} ${
              emailVerified ? styles.planMetaVSuccess : styles.planMetaVWarn
            }`}
          >
            {emailVerified
              ? `✓ ${tFree("emailVerified")}`
              : tFree("emailUnverified")}
          </div>
        </div>
        <div>
          <div className={styles.planMetaK}>{tFree("addressLabel")}</div>
          <div className={`${styles.planMetaV} ${styles.planMetaVMono}`}>
            {email}
          </div>
        </div>
      </div>

      {emailVerified ? null : (
        <div className={styles.rewardNote}>
          <span className={styles.rewardNoteIcon}>
            <GiftIcon />
          </span>
          <div className={styles.rewardNoteText}>
            <div className={styles.rewardNoteTitle}>
              {tFree("rewardNoteTitle")}{" "}
              <span className={styles.rewardNoteAmount}>
                {tFree("rewardNoteAmount", { amount: bonusAmount })}
              </span>
            </div>
            <div className={styles.rewardNoteBody}>
              {tFree("rewardNoteBody")}
            </div>
          </div>
        </div>
      )}

      <Button
        className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull} ${styles.planCta}`}
        disabled={isSending}
        onClick={handleClick}
      >
        {emailVerified ? null : isSending ? <Loader size={16} /> : <MailIcon />}
        {emailVerified ? tFree("viewPlansCta") : tFree("confirmEmailCta")}
      </Button>
    </section>
  );
}
