"use client";

import { useCallback, useEffect, useState } from "react";

import { useTranslations } from "@/lib/i18n/translate";

import {
  type AuthFormError,
  type AuthFormField,
  NETWORK_FORM_ERROR,
} from "./form-errors";

/** The attributes a field gets while the form error is about it. */
export type AuthFieldErrorProps = {
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

/** Handlers for the `<form>`: an edit or a new submit hides the message. */
export type AuthFormErrorFormProps = {
  onChange: () => void;
  onSubmit: () => void;
};

export type AuthFormErrorControls = {
  /** The id of the message element, referenced by the invalid fields. */
  errorId: string;
  /** The current error, or `null` when the form shows none. */
  formError: AuthFormError | null;
  /** The translated message, or `null`. */
  message: string | null;
  showError: (formError: AuthFormError | null) => void;
  getFieldProps: (field: AuthFormField) => AuthFieldErrorProps;
  formProps: AuthFormErrorFormProps;
  /**
   * Runs a server action and shows the error its result maps to. A rejected
   * action (offline, a 5xx page) shows the network message and resolves with
   * `fallbackState`, so the form stays usable instead of hitting the error
   * boundary.
   */
  runAction: <State>(
    action: () => Promise<State>,
    getError: (state: State) => AuthFormError | null,
    fallbackState: State
  ) => Promise<State>;
};

type UseAuthFormErrorOptions = {
  errorId: string;
  /** DOM ids of the form's fields, used to focus the first invalid one. */
  fieldIds: Partial<Record<AuthFormField, string>>;
};

/**
 * The error state shared by the four auth forms. The message stays until the
 * user edits a field or submits again; clearing it on submit empties the live
 * region first, so a repeated failure with the same text is announced again.
 */
export const useAuthFormError = ({
  errorId,
  fieldIds,
}: UseAuthFormErrorOptions): AuthFormErrorControls => {
  const t = useTranslations("auth.formErrors");
  const [formError, setFormError] = useState<AuthFormError | null>(null);

  useEffect(() => {
    const firstField = formError?.fields[0];
    if (!firstField) {
      return;
    }

    const fieldId = fieldIds[firstField];
    if (fieldId) {
      document.getElementById(fieldId)?.focus();
    }
  }, [formError, fieldIds]);

  const clearError = useCallback(() => {
    setFormError(null);
  }, []);

  const getFieldProps = (field: AuthFormField): AuthFieldErrorProps =>
    formError?.fields.includes(field)
      ? { "aria-invalid": true, "aria-describedby": errorId }
      : {};

  const runAction = async <State>(
    action: () => Promise<State>,
    getError: (state: State) => AuthFormError | null,
    fallbackState: State
  ): Promise<State> => {
    try {
      const nextState = await action();
      setFormError(getError(nextState));
      return nextState;
    } catch {
      // The request never produced an action result; the message tells the
      // user to check the connection, and the form keeps its values.
      setFormError(NETWORK_FORM_ERROR);
      return fallbackState;
    }
  };

  return {
    errorId,
    formError,
    message: formError ? t(formError.messageKey, formError.params) : null,
    showError: setFormError,
    getFieldProps,
    formProps: { onChange: clearError, onSubmit: clearError },
    runAction,
  };
};
