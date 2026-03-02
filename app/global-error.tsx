"use client";

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "system-ui, sans-serif",
          backgroundColor: "#0a0a0a",
          color: "#fafafa",
          margin: 0,
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
            Something went wrong
          </h2>
          <p
            style={{
              color: "#a1a1aa",
              marginBottom: "1.5rem",
              maxWidth: "400px",
            }}
          >
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.625rem 1.25rem",
              backgroundColor: "#fafafa",
              color: "#0a0a0a",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
            type="button"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
