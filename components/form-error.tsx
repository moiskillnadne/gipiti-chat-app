import type { ReactNode } from "react";

type FormErrorProps = {
  id: string;
  message: string | null;
  /** An optional next-step link shown after the message. */
  children?: ReactNode;
};

/**
 * The message of a failed form submit. The alert region is always rendered,
 * empty when there is no error, so screen readers announce the text when it
 * appears. `empty:-mt-4` cancels the `gap-4` of the auth forms while the
 * region is empty, so it takes no room.
 */
export const FormError = ({ id, message, children }: FormErrorProps) => (
  <div
    className="empty:-mt-4 text-danger-ink text-sm"
    data-testid="form-error"
    id={id}
    role="alert"
  >
    {message && (
      <p>
        {message}
        {children && <> {children}</>}
      </p>
    )}
  </div>
);
