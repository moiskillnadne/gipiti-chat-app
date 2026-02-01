/**
 * Cancellation reason codes for subscription feedback tracking.
 * These codes are stored in the CancellationFeedback table.
 */
export const CANCELLATION_REASONS = {
  TOO_EXPENSIVE: "too_expensive",
  NOT_USING_ENOUGH: "not_using_enough",
  MISSING_FEATURES: "missing_features",
  TECHNICAL_ISSUES: "technical_issues",
  FOUND_ALTERNATIVE: "found_alternative",
  TEMPORARY_PAUSE: "temporary_pause",
  POOR_PERFORMANCE: "poor_performance",
  POOR_RESPONSE_QUALITY: "poor_response_quality",
} as const;

export type CancellationReasonCode =
  (typeof CANCELLATION_REASONS)[keyof typeof CANCELLATION_REASONS];

/** Array of all valid reason codes for validation */
export const VALID_REASON_CODES = Object.values(CANCELLATION_REASONS);

/**
 * Mapping of reason codes to translation keys.
 * Used to look up the correct translation for each reason.
 */
export const REASON_TRANSLATION_KEYS: Record<CancellationReasonCode, string> = {
  [CANCELLATION_REASONS.TOO_EXPENSIVE]: "tooExpensive",
  [CANCELLATION_REASONS.NOT_USING_ENOUGH]: "notUsingEnough",
  [CANCELLATION_REASONS.MISSING_FEATURES]: "missingFeatures",
  [CANCELLATION_REASONS.TECHNICAL_ISSUES]: "technicalIssues",
  [CANCELLATION_REASONS.FOUND_ALTERNATIVE]: "foundAlternative",
  [CANCELLATION_REASONS.TEMPORARY_PAUSE]: "temporaryPause",
  [CANCELLATION_REASONS.POOR_PERFORMANCE]: "poorPerformance",
  [CANCELLATION_REASONS.POOR_RESPONSE_QUALITY]: "poorResponseQuality",
};

/** Minimum characters required for additional feedback text */
export const MIN_FEEDBACK_LENGTH = 20;

/**
 * Validates that provided reason codes are valid.
 * @param reasons Array of reason codes to validate
 * @returns true if all codes are valid, false otherwise
 */
export function validateReasonCodes(reasons: string[]): boolean {
  return reasons.every((code) =>
    VALID_REASON_CODES.includes(code as CancellationReasonCode)
  );
}
