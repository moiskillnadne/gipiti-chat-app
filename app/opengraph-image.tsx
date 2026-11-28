/** biome-ignore-all lint/performance/noImgElement: Satori (next/og) renders only plain <img> */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const alt = "GIPITI — все лучшие нейросети в одном чате";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

/**
 * Slate & Citrus tokens from app/globals.css. Satori does not parse oklch(),
 * so the citrus and model-dot colours are their sRGB hex equivalents.
 */
const COLORS = {
  paper: "#fafaf9",
  paper2: "#f1f0ec",
  rule: "#e3e2dd",
  ink: "#14161a",
  ink3: "#696d74",
  citrus: "#e5c226",
  citrusSoft: "#f5e5a8",
} as const;

type ModelChip = { name: string; dotColor: string };

const MODEL_CHIPS: ModelChip[] = [
  { name: "GPT-6", dotColor: "#008a48" },
  { name: "Gemini 3.1 Pro", dotColor: "#2580c1" },
  { name: "Claude Opus 5.5", dotColor: "#c96900" },
  { name: "Grok 4.7", dotColor: "#51536c" },
];

type FontWeight = 500 | 700;

/**
 * Satori uses one file per family name and weight, so the latin and Cyrillic
 * subsets of a weight are separate families listed together: a Cyrillic glyph
 * then comes from the Cyrillic file of the same weight.
 */
const FONT_FILES: { file: string; name: string; weight: FontWeight }[] = [
  { file: "rubik-latin-700-normal.woff", name: "Rubik Bold", weight: 700 },
  {
    file: "rubik-cyrillic-700-normal.woff",
    name: "Rubik Bold Cyrillic",
    weight: 700,
  },
  { file: "rubik-latin-500-normal.woff", name: "Rubik Medium", weight: 500 },
  {
    file: "rubik-cyrillic-500-normal.woff",
    name: "Rubik Medium Cyrillic",
    weight: 500,
  },
];

const BOLD_FONT = "Rubik Bold, Rubik Bold Cyrillic";
const MEDIUM_FONT = "Rubik Medium, Rubik Medium Cyrillic";

const readAsset = (...segments: string[]): Promise<Buffer> =>
  readFile(join(process.cwd(), ...segments));

/** Site-wide share card: the cube logo on paper, Rubik type, citrus accent. */
export default async function Image(): Promise<ImageResponse> {
  const [logoBytes, ...fontBuffers] = await Promise.all([
    readAsset("app", "icon.png"),
    ...FONT_FILES.map(({ file }) => readAsset("assets", "fonts", file)),
  ]);
  const logoSrc = `data:image/png;base64,${logoBytes.toString("base64")}`;
  const fonts = FONT_FILES.map(({ name, weight }, index) => ({
    name,
    data: fontBuffers[index],
    weight,
    style: "normal" as const,
  }));

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "64px 80px",
        background: COLORS.paper,
        fontFamily: MEDIUM_FONT,
        color: COLORS.ink,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", width: "700px" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: "58px",
            fontFamily: BOLD_FONT,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-1.5px",
          }}
        >
          <span>Все лучшие нейросети</span>
          <span style={{ display: "flex" }}>
            <span
              style={{
                padding: "0 12px",
                marginLeft: "-12px",
                borderRadius: "12px",
                background: COLORS.citrusSoft,
              }}
            >
              в одном чате
            </span>
          </span>
        </div>

        <div
          style={{
            marginTop: "28px",
            fontSize: "26px",
            fontWeight: 500,
            lineHeight: 1.35,
            color: COLORS.ink3,
          }}
        >
          Генерируйте текст, изображения и видео, анализируйте документы.
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            marginTop: "40px",
          }}
        >
          {MODEL_CHIPS.map(({ name, dotColor }) => (
            <div
              key={name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 16px",
                borderRadius: "9999px",
                border: `1px solid ${COLORS.rule}`,
                background: "#ffffff",
                fontSize: "18px",
                fontWeight: 500,
              }}
            >
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "9999px",
                  background: dotColor,
                }}
              />
              {name}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "28px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "300px",
            height: "300px",
            borderRadius: "9999px",
            background: COLORS.citrus,
          }}
        >
          <img alt="" height={216} src={logoSrc} width={216} />
        </div>
        <div
          style={{
            fontFamily: BOLD_FONT,
            fontSize: "24px",
            fontWeight: 700,
            letterSpacing: "-0.5px",
          }}
        >
          gipiti.ru
        </div>
      </div>
    </div>,
    { ...size, fonts }
  );
}
