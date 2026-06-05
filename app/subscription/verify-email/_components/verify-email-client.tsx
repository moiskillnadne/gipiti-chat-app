"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type ResendVerificationActionState,
  resendVerificationCode,
  type VerifyEmailActionState,
  verifyEmail,
} from "@/app/(auth)/actions";
import { toast } from "@/components/toast";
import { useTranslations } from "@/lib/i18n/translate";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  GiftIcon,
  MailIcon,
  RefreshIcon,
  XIcon,
} from "../../_components/icons";
import styles from "../verify-email.module.css";
import { OtpInputs, type OtpStatus } from "./otp-inputs";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;
const OK_TO_DONE_MS = 650;
const ERROR_RESET_MS = 1100;

const VERIFY_INITIAL: VerifyEmailActionState = { status: "idle" };
const RESEND_INITIAL: ResendVerificationActionState = { status: "idle" };

const emptyDigits = (): string[] => new Array<string>(CODE_LENGTH).fill("");

export type VerifyEmailClientProps = {
  email: string;
  bonusAmount: string;
};

export function VerifyEmailClient({
  email,
  bonusAmount,
}: VerifyEmailClientProps) {
  const t = useTranslations("auth.subscription.verifyEmail");
  const router = useRouter();
  const { update } = useSession();

  const [digits, setDigits] = useState<string[]>(emptyDigits);
  const [status, setStatus] = useState<OtpStatus>("idle");
  const [isDone, setIsDone] = useState(false);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [errorKey, setErrorKey] = useState<"statusError" | "statusExpired">(
    "statusError"
  );

  const [verifyState, verifyAction, isVerifying] = useActionState(
    verifyEmail,
    VERIFY_INITIAL
  );
  const [resendState, resendAction] = useActionState(
    resendVerificationCode,
    RESEND_INITIAL
  );

  const lastResendStatus =
    useRef<ResendVerificationActionState["status"]>("idle");

  // Resend cooldown countdown.
  useEffect(() => {
    if (seconds <= 0) {
      return;
    }
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const submitCode = useCallback(
    (code: string): void => {
      if (code.length !== CODE_LENGTH) {
        return;
      }
      setStatus("verifying");
      const payload = new FormData();
      payload.set("email", email);
      payload.set("code", code);
      verifyAction(payload);
    },
    [email, verifyAction]
  );

  // React to verification results.
  useEffect(() => {
    const { status: resultStatus } = verifyState;

    if (resultStatus === "success" || resultStatus === "already_verified") {
      setStatus("ok");
      const timer = setTimeout(() => {
        setIsDone(true);
        // Best-effort JWT refresh so the dashboard sees the verified state.
        update({ emailVerified: true }).catch(() => {
          // Ignored — the next navigation re-reads the session from the cookie.
        });
      }, OK_TO_DONE_MS);
      return () => clearTimeout(timer);
    }

    if (resultStatus === "invalid_code" || resultStatus === "expired_code") {
      setErrorKey(
        resultStatus === "expired_code" ? "statusExpired" : "statusError"
      );
      setStatus("error");
      const timer = setTimeout(() => {
        setDigits(emptyDigits());
        setStatus("idle");
      }, ERROR_RESET_MS);
      return () => clearTimeout(timer);
    }

    if (resultStatus === "failed" || resultStatus === "invalid_data") {
      toast({ type: "error", description: t("toastVerifyError") });
      setErrorKey("statusError");
      setStatus("error");
      const timer = setTimeout(() => {
        setDigits(emptyDigits());
        setStatus("idle");
      }, ERROR_RESET_MS);
      return () => clearTimeout(timer);
    }
  }, [verifyState, t, update]);

  // React to resend results.
  useEffect(() => {
    if (resendState.status === lastResendStatus.current) {
      return;
    }
    lastResendStatus.current = resendState.status;

    if (resendState.status === "success") {
      toast({ type: "success", description: t("toastResent") });
      return;
    }
    if (resendState.status === "rate_limited") {
      setSeconds(resendState.cooldownSeconds ?? RESEND_SECONDS);
      toast({ type: "error", description: t("toastCooldown") });
      return;
    }
    if (
      resendState.status === "failed" ||
      resendState.status === "invalid_data"
    ) {
      toast({ type: "error", description: t("toastResendError") });
    }
  }, [resendState, t]);

  const handleResend = (): void => {
    if (seconds > 0) {
      return;
    }
    const payload = new FormData();
    payload.set("email", email);
    resendAction(payload);
    setSeconds(RESEND_SECONDS);
    setDigits(emptyDigits());
    setStatus("idle");
  };

  const goToBalance = (): void => {
    router.push("/subscription");
    router.refresh();
  };

  const isBusy = status === "verifying" || status === "ok" || isVerifying;
  const isComplete = digits.every((digit) => digit !== "");

  return (
    <div className={styles.page}>
      <nav className={styles.topnav}>
        <Link className={styles.back} href="/subscription">
          <ArrowLeftIcon aria-label={t("back")} />
          {t("back")}
        </Link>
        <span className={styles.crumb}>
          {t("crumbAccount")}
          <span className={styles.crumbSep}>/</span>
          {t("crumbSubscription")}
          <span className={styles.crumbSep}>/</span>
          <span className={styles.crumbActive}>{t("crumb")}</span>
        </span>
        <div className={styles.navSpacer} />
        {isDone ? (
          <span className={`${styles.pill} ${styles.pillDone}`}>
            {t("pillVerified")}
          </span>
        ) : (
          <span className={`${styles.pill} ${styles.pillWarn}`}>
            {t("pillUnverified")}
          </span>
        )}
      </nav>

      <div className={styles.stage}>
        {isDone ? (
          <div className={styles.card}>
            <span className={styles.check}>
              <CheckIcon />
            </span>
            <h1 className={styles.title}>
              {t("titleDoneLead")}
              <em>{t("titleDoneEmphasis")}</em>.
            </h1>
            <p className={styles.lede}>
              {t("ledeDonePrefix")} <em>{email}</em> {t("ledeDoneSuffix")}
            </p>
            <div className={styles.creditBurst}>
              <span className={styles.creditLabel}>{t("creditLabel")}</span>
              <span className={styles.creditAmount}>
                <span className={styles.creditPlus}>+</span>
                {bonusAmount}
              </span>
            </div>
            <div className={styles.actions}>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={goToBalance}
                type="button"
              >
                {t("goToBalance")}
                <ArrowRightIcon />
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.card}>
            <span className={styles.eyebrow}>
              <span className={styles.eyebrowDot} />
              {t("eyebrow")}
            </span>
            <h1 className={styles.title}>
              {t("titleLead")}
              <em>{t("titleEmphasis")}</em>.
            </h1>
            <p className={styles.lede}>{t("lede")}</p>
            <span className={styles.sentTo}>
              <MailIcon />
              <b>{email}</b>
            </span>

            <div className={styles.reward}>
              <span className={styles.rewardGift}>
                <GiftIcon />
              </span>
              <div className={styles.rewardText}>
                <b>
                  {t("rewardTitlePrefix")}{" "}
                  <span className={styles.rewardAmount}>+{bonusAmount}</span>{" "}
                  {t("rewardTitleSuffix")}
                </b>
                <span>{t("rewardBody")}</span>
              </div>
            </div>

            <OtpInputs
              codeLength={CODE_LENGTH}
              digitLabel={(position) => t("digitLabel", { position })}
              digits={digits}
              disabled={isBusy}
              onComplete={submitCode}
              setDigits={setDigits}
              status={status}
            />

            <StatusLine errorMessage={t(errorKey)} status={status} t={t} />

            <div className={styles.resendRow}>
              <span>{t("resendQuestion")}</span>
              {seconds === 0 ? (
                <button
                  className={`${styles.resendBtn} ${styles.resendReady}`}
                  onClick={handleResend}
                  type="button"
                >
                  <RefreshIcon />
                  <u>{t("resendAction")}</u>
                </button>
              ) : (
                <span className={`${styles.resendBtn} ${styles.resendCooling}`}>
                  <RefreshIcon />
                  <span className={styles.resendTimer}>
                    {t("resendCountdown", { seconds })}
                  </span>
                </span>
              )}
            </div>

            <div className={styles.actions}>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={!isComplete || isBusy}
                onClick={() => submitCode(digits.join(""))}
                type="button"
              >
                {isBusy ? (
                  <>
                    <span className={styles.btnSpinner} />
                    {t("submitting")}
                  </>
                ) : (
                  <>
                    {t("submit")}
                    <ArrowRightIcon />
                  </>
                )}
              </button>
              <Link
                className={`${styles.btn} ${styles.btnGhost}`}
                href="/legal/support"
              >
                {t("changeEmail")}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type StatusLineProps = {
  status: OtpStatus;
  errorMessage: string;
  t: ReturnType<typeof useTranslations>;
};

function StatusLine({ status, errorMessage, t }: StatusLineProps) {
  if (status === "verifying") {
    return (
      <div className={`${styles.otpStatus} ${styles.otpStatusIdle}`}>
        {t("statusVerifying")}
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className={`${styles.otpStatus} ${styles.otpStatusError}`}>
        <XIcon />
        {errorMessage}
      </div>
    );
  }
  if (status === "ok") {
    return (
      <div className={`${styles.otpStatus} ${styles.otpStatusOk}`}>
        <CheckIcon />
        {t("statusOk")}
      </div>
    );
  }
  return (
    <div className={`${styles.otpStatus} ${styles.otpStatusIdle}`}>
      {t("statusIdle")}
    </div>
  );
}
