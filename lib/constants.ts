import { generateDummyPassword } from "./db/utils";

export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";

/**
 * Gate for verbose logging of the Google-bound chat payload (assistant parts +
 * thought-signature presence). Off unless `DEBUG_GEMINI_SIGNATURES=true`. Used
 * to diagnose Gemini "Corrupted thought signature" issues (GIPITI-82) without
 * leaking signature values into logs.
 */
export const isGeminiSignatureDebugEnabled =
  process.env.DEBUG_GEMINI_SIGNATURES === "true";

export const DUMMY_PASSWORD = generateDummyPassword();
