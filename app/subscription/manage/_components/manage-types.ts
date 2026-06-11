/** Server-formatted strings handed to the cancel flow dialog. */
export type CancelDialogData = {
  /** Full period-end date, e.g. "1 июня 2026 г." */
  dateFull: string;
  /** Short period-end date, e.g. "1 июня". */
  dateShort: string;
  /** Formatted subscription-pool remainder (burns at period end). */
  subAmount: string;
  /** Formatted top-up pool remainder (stays on the balance). */
  topupAmount: string;
  cardMask: string | null;
};

/** Server-formatted strings handed to the resume dialog. */
export type ResumeDialogData = {
  /** Full period-end date — the next charge date after resuming. */
  dateFull: string;
  /** Formatted plan price, e.g. "1 999 ₽". */
  priceText: string;
  cardMask: string | null;
};
