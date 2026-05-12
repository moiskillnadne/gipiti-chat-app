"use client";

import { OTPInput, type SlotProps } from "input-otp";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type ResendVerificationActionState,
  resendVerificationCode,
  type VerifyEmailActionState,
  verifyEmail,
} from "@/app/(auth)/actions";
import dashboardStyles from "@/app/subscription/_components/dashboard.module.css";
import {
  ArrowRightIcon,
  CheckIcon,
  MailIcon,
  RefreshIcon,
} from "@/app/subscription/_components/icons";
import { toast } from "@/components/toast";
import { useTranslations } from "@/lib/i18n/translate";
import styles from "./confirm-email.module.css";
import { RewardCard } from "./reward-card";

const OTP_LENGTH = 6;
const CODE_TTL_SECONDS = 600; // 10 minutes
const RESEND_COOLDOWN_SECONDS = 60;

type Props = {
  initialView: "otp" | "success";
};

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function ConfirmEmailForm({ initialView }: Props) {
  const t = useTranslations("auth.confirmEmail");
  const tErrors = useTranslations("auth.errors");
  const tNotifications = useTranslations("common.notifications");
  const tVerification = useTranslations("auth.verification");
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();

  const email = session?.user?.email ?? "";
  const [code, setCode] = useState("");
  const [view, setView] = useState<"otp" | "success">(initialView);
  const [ttlSeconds, setTtlSeconds] = useState(CODE_TTL_SECONDS);
  const [cooldown, setCooldown] = useState(0);
  const [isUpdatingSession, setIsUpdatingSession] = useState(false);
  const hasHandledSuccess = useRef(false);

  const [verifyState, verifyAction] = useActionState<
    VerifyEmailActionState,
    FormData
  >(verifyEmail, { status: "idle" });

  const [resendState, resendAction] = useActionState<
    ResendVerificationActionState,
    FormData
  >(resendVerificationCode, { status: "idle" });

  const isCodeExpired = ttlSeconds <= 0;
  const isVerifying = verifyState.status === "in_progress" || isUpdatingSession;
  const isResending = resendState.status === "in_progress";
  const isFormDisabled = isVerifying || view === "success";

  useEffect(() => {
    if (view !== "otp" || ttlSeconds <= 0) {
      return;
    }
    const timer = setTimeout(() => setTtlSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [view, ttlSeconds]);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleVerifySuccess = useCallback(async () => {
    if (hasHandledSuccess.current) {
      return;
    }
    hasHandledSuccess.current = true;
    setIsUpdatingSession(true);
    try {
      await updateSession({ emailVerified: true });
    } catch {
      // session refresh is best-effort
    }
    setIsUpdatingSession(false);
    setView("success");
  }, [updateSession]);

  useEffect(() => {
    if (verifyState.status === "invalid_code") {
      toast({ type: "error", description: tErrors("invalidCode") });
      return;
    }
    if (verifyState.status === "expired_code") {
      toast({ type: "error", description: tErrors("expiredCode") });
      setTtlSeconds(0);
      return;
    }
    if (verifyState.status === "failed") {
      toast({ type: "error", description: tNotifications("genericError") });
      return;
    }
    if (verifyState.status === "invalid_data") {
      toast({ type: "error", description: tErrors("invalidData") });
      return;
    }
    if (
      verifyState.status === "already_verified" ||
      verifyState.status === "success"
    ) {
      handleVerifySuccess();
    }
  }, [verifyState.status, tErrors, tNotifications, handleVerifySuccess]);

  useEffect(() => {
    if (resendState.status === "rate_limited") {
      setCooldown(resendState.cooldownSeconds || RESEND_COOLDOWN_SECONDS);
      toast({ type: "error", description: tVerification("rateLimited") });
      return;
    }
    if (resendState.status === "failed") {
      toast({ type: "error", description: tNotifications("genericError") });
      return;
    }
    if (resendState.status === "success") {
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setTtlSeconds(CODE_TTL_SECONDS);
      setCode("");
      hasHandledSuccess.current = false;
      toast({ type: "success", description: tVerification("codeSent") });
    }
  }, [
    resendState.status,
    resendState.cooldownSeconds,
    tVerification,
    tNotifications,
  ]);

  const submitCode = useCallback(
    (rawCode: string) => {
      if (!email || rawCode.length !== OTP_LENGTH || isCodeExpired) {
        return;
      }
      const formData = new FormData();
      formData.set("email", email);
      formData.set("code", rawCode);
      startTransition(() => verifyAction(formData));
    },
    [email, isCodeExpired, verifyAction]
  );

  const handleChange = useCallback(
    (next: string) => {
      setCode(next);
      if (next.length === OTP_LENGTH && !isVerifying) {
        submitCode(next);
      }
    },
    [submitCode, isVerifying]
  );

  const handleVerifyClick = useCallback(() => {
    submitCode(code);
  }, [submitCode, code]);

  const handleResend = useCallback(() => {
    if (cooldown > 0 || !email || isResending) {
      return;
    }
    const formData = new FormData();
    formData.set("email", email);
    startTransition(() => resendAction(formData));
  }, [cooldown, email, isResending, resendAction]);

  const handlePasteCode = useCallback(async () => {
    if (!navigator.clipboard?.readText) {
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      const digits = text.replace(/\D/g, "").slice(0, OTP_LENGTH);
      if (digits.length === OTP_LENGTH) {
        setCode(digits);
        submitCode(digits);
      } else if (digits.length > 0) {
        setCode(digits);
      }
    } catch {
      // clipboard access denied — silently ignore
    }
  }, [submitCode]);

  const eyebrow = useMemo(() => {
    if (isCodeExpired) {
      return t("expiredEyebrow");
    }
    return t("awaitingCode", { time: formatCountdown(ttlSeconds) });
  }, [isCodeExpired, t, ttlSeconds]);

  if (view === "success") {
    return (
      <div className={styles.grid}>
        <section className={styles.confirmCard}>
          <span className={styles.confirmCheck}>
            <CheckIcon />
          </span>
          <h2 className={styles.cardTitle}>
            {t("successCardTitle")} <em>{t("successCardTitleEm")}</em>.
          </h2>
          <p className={styles.cardLede}>
            {t("successCardLedePrefix")} <em>{email}</em>{" "}
            {t("successCardLedeSuffix")}
          </p>

          <div className={styles.creditBurst}>
            <span className={styles.creditBurstLabel}>
              {t("creditBurstLabel")}
            </span>
            <span className={styles.creditBurstAmount}>
              <span className={styles.creditBurstPlus}>+50</span>
              <span className={styles.creditBurstUnit}>{t("bonusUnit")}</span>
            </span>
          </div>

          <div className={styles.actions}>
            <Link
              className={`${dashboardStyles.btn} ${dashboardStyles.btnPrimary} ${styles.actionsFlex}`}
              href="/subscribe"
            >
              {t("goPlans")}
              <ArrowRightIcon />
            </Link>
            <Link
              className={styles.btnGhost}
              href="/subscription"
              onClick={() => router.refresh()}
            >
              {t("backToOverview")}
            </Link>
          </div>
        </section>

        <RewardCard email={email} variant="unlocked" />
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      <section className={styles.confirmCard}>
        <span className={styles.eyebrow}>
          <span
            className={`${styles.eyebrowDot} ${isCodeExpired ? styles.eyebrowDotExpired : ""}`}
          />
          {eyebrow}
        </span>
        <h2 className={styles.cardTitle}>
          {t("cardTitle")} <em>{t("cardTitleEm")}</em>.
        </h2>
        <p className={styles.cardLede}>
          {t("cardLede")} <em>{t("cardLedeEm")}</em>.
        </p>
        <div className={styles.sentTo}>
          <MailIcon />
          <span>
            {t("sentToPrefix")} <b>{email}</b>
          </span>
        </div>

        <OTPInput
          containerClassName={styles.otpRow}
          disabled={isFormDisabled}
          inputMode="numeric"
          maxLength={OTP_LENGTH}
          onChange={handleChange}
          render={({ slots }) => (
            <>
              {slots.map((slot, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length OTP slots
                <OtpCell key={index} slot={slot} />
              ))}
            </>
          )}
          value={code}
        />

        <div className={styles.otpMeta}>
          <span>{t("notReceived")}</span>
          <button
            className={`${styles.resend} ${cooldown > 0 || isResending ? styles.resendDisabled : ""}`}
            disabled={cooldown > 0 || isResending}
            onClick={handleResend}
            type="button"
          >
            {cooldown > 0
              ? t("resendCooldown", { seconds: cooldown })
              : isResending
                ? t("resendInFlight")
                : t("resend")}
          </button>
        </div>

        <div className={styles.actions}>
          <button
            className={`${dashboardStyles.btn} ${dashboardStyles.btnPrimary} ${styles.actionsFlex}`}
            disabled={
              code.length !== OTP_LENGTH || isVerifying || isCodeExpired
            }
            onClick={handleVerifyClick}
            type="button"
          >
            {t("verifyBtn")}
            <ArrowRightIcon />
          </button>
          <button
            className={styles.btnGhost}
            disabled={isFormDisabled}
            onClick={handlePasteCode}
            type="button"
          >
            <RefreshIcon />
            {t("pasteCode")}
          </button>
        </div>
      </section>

      <RewardCard variant="pending" />
    </div>
  );
}

function OtpCell({ slot }: { slot: SlotProps }) {
  const { char, isActive, hasFakeCaret } = slot;
  const className = [
    styles.otpCell,
    char ? styles.otpCellFilled : "",
    isActive ? styles.otpCellActive : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      {char}
      {!char && hasFakeCaret && <span className={styles.otpCaret} />}
    </div>
  );
}
