import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "GIPITI - AI-чат с ChatGPT, Gemini, Claude и Grok";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "120px",
            height: "120px",
            borderRadius: "24px",
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            boxShadow: "0 20px 40px rgba(99, 102, 241, 0.3)",
          }}
        >
          <svg
            fill="none"
            height="64"
            stroke="white"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="64"
          >
            <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
            <path d="M12 2a10 10 0 0 1 10 10" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        </div>

        <h1
          style={{
            fontSize: "72px",
            fontWeight: "bold",
            color: "white",
            margin: "0",
            letterSpacing: "-2px",
          }}
        >
          GIPITI
        </h1>

        <p
          style={{
            fontSize: "32px",
            color: "#a1a1aa",
            margin: "0",
            textAlign: "center",
            maxWidth: "800px",
          }}
        >
          AI-чат с ChatGPT, Gemini, Claude и Grok
        </p>

        <div
          style={{
            display: "flex",
            gap: "16px",
            marginTop: "24px",
          }}
        >
          {["ChatGPT 5.2", "Gemini 3.1 Pro", "Opus 4.6", "Grok 4.1"].map(
            (model) => (
              <div
                key={model}
                style={{
                  padding: "12px 24px",
                  borderRadius: "9999px",
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  color: "#e4e4e7",
                  fontSize: "18px",
                }}
              >
                {model}
              </div>
            )
          )}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "40px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          color: "#71717a",
          fontSize: "20px",
        }}
      >
        <span>gipiti.ru</span>
      </div>
    </div>,
    {
      ...size,
    }
  );
}
