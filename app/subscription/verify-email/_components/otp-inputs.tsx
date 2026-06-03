"use client";

import {
  type ChangeEvent,
  type ClipboardEvent,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
  useEffect,
  useRef,
} from "react";
import styles from "../verify-email.module.css";

export type OtpStatus = "idle" | "verifying" | "error" | "ok";

export type OtpInputsProps = {
  digits: string[];
  setDigits: Dispatch<SetStateAction<string[]>>;
  status: OtpStatus;
  disabled: boolean;
  codeLength: number;
  digitLabel: (position: number) => string;
  onComplete: (code: string) => void;
};

const NON_DIGIT = /\D/g;

export function OtpInputs({
  digits,
  setDigits,
  status,
  disabled,
  codeLength,
  digitLabel,
  onComplete,
}: OtpInputsProps) {
  const cellRefs = useRef<Array<HTMLInputElement | null>>([]);

  const focusCell = (index: number): void => {
    const cell = cellRefs.current[index];
    if (cell) {
      cell.focus();
      cell.select();
    }
  };

  const setAt = (index: number, value: string): void => {
    setDigits((previous) => {
      const next = [...previous];
      next[index] = value;
      return next;
    });
  };

  const handleChange = (
    index: number,
    event: ChangeEvent<HTMLInputElement>
  ): void => {
    const raw = event.target.value.replace(NON_DIGIT, "");
    if (!raw) {
      setAt(index, "");
      return;
    }

    const lastChar = raw.at(-1) ?? "";
    setAt(index, lastChar);

    if (index < codeLength - 1) {
      focusCell(index + 1);
    } else {
      event.target.blur();
    }
  };

  const handleKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLInputElement>
  ): void => {
    if (event.key === "Backspace") {
      if (digits[index]) {
        setAt(index, "");
      } else if (index > 0) {
        focusCell(index - 1);
        setAt(index - 1, "");
      }
      event.preventDefault();
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      focusCell(index - 1);
      event.preventDefault();
      return;
    }

    if (event.key === "ArrowRight" && index < codeLength - 1) {
      focusCell(index + 1);
      event.preventDefault();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>): void => {
    event.preventDefault();
    const pasted = (event.clipboardData.getData("text") || "")
      .replace(NON_DIGIT, "")
      .slice(0, codeLength);
    if (!pasted) {
      return;
    }

    const next = new Array<string>(codeLength).fill("");
    for (let position = 0; position < pasted.length; position++) {
      next[position] = pasted[position];
    }
    setDigits(next);
    focusCell(Math.min(pasted.length, codeLength - 1));
  };

  // Auto-submit once every cell is filled and we are not mid-verification.
  useEffect(() => {
    const isComplete = digits.every((digit) => digit !== "");
    if (isComplete && status !== "verifying" && status !== "ok") {
      onComplete(digits.join(""));
    }
  }, [digits, status, onComplete]);

  const isError = status === "error";

  return (
    <div className={`${styles.otpRow} ${isError ? styles.otpShake : ""}`}>
      {digits.map((digit, index) => {
        const cellClassName = [
          styles.otpCell,
          digit ? styles.otpCellFilled : "",
          isError ? styles.otpCellError : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <input
            aria-label={digitLabel(index + 1)}
            autoComplete={index === 0 ? "one-time-code" : "off"}
            className={cellClassName}
            disabled={disabled}
            inputMode="numeric"
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length positional OTP cells
            key={index}
            maxLength={1}
            onChange={(event) => handleChange(index, event)}
            onFocus={(event) => event.target.select()}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={handlePaste}
            ref={(element) => {
              cellRefs.current[index] = element;
            }}
            type="text"
            value={digit}
          />
        );
      })}
    </div>
  );
}
