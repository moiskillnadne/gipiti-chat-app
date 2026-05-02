export type SwatchClass =
  | "swatch-1"
  | "swatch-2"
  | "swatch-3"
  | "swatch-4"
  | "swatch-5"
  | "swatch-6";

export type SwatchToken = "sw1" | "sw2" | "sw3" | "sw4" | "sw5" | "sw6";

export const SWATCH_TOKENS: readonly SwatchToken[] = [
  "sw1",
  "sw2",
  "sw3",
  "sw4",
  "sw5",
  "sw6",
];

const SWATCH_COUNT = 6;

const hashId = (id: string): number => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

export const getSwatchClass = (id: string): SwatchClass => {
  const index = hashId(id) % SWATCH_COUNT;
  return `swatch-${index + 1}` as SwatchClass;
};

export const getSwatchToken = (id: string): SwatchToken => {
  const index = hashId(id) % SWATCH_COUNT;
  return `sw${index + 1}` as SwatchToken;
};

export const swatchTokenToClass = (token: SwatchToken): SwatchClass =>
  `swatch-${token.slice(2)}` as SwatchClass;

export const resolveSwatchClass = (
  storedSwatch: string | null | undefined,
  fallbackId: string
): SwatchClass => {
  if (
    storedSwatch &&
    (SWATCH_TOKENS as readonly string[]).includes(storedSwatch)
  ) {
    return swatchTokenToClass(storedSwatch as SwatchToken);
  }
  return getSwatchClass(fallbackId);
};

export const resolveSwatchToken = (
  storedSwatch: string | null | undefined,
  fallbackId: string
): SwatchToken => {
  if (
    storedSwatch &&
    (SWATCH_TOKENS as readonly string[]).includes(storedSwatch)
  ) {
    return storedSwatch as SwatchToken;
  }
  return getSwatchToken(fallbackId);
};
