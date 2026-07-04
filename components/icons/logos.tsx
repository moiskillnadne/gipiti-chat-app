import type { FC } from "react";

import type { ModelProvider } from "@/lib/ai/models";

import AnthropicSvg from "./logos/anthropic.svg";
import BflSvg from "./logos/bfl.svg";
import GoogleSvg from "./logos/google.svg";
import KlingSvg from "./logos/klingai.svg";
import OpenAiSvg from "./logos/openai.svg";
import RecraftSvg from "./logos/recraft.svg";
import XaiSvg from "./logos/xai.svg";

export type LogoProps = {
  size?: number;
};

export const LogoOpenAI: FC<LogoProps> = ({ size = 16 }) => (
  <OpenAiSvg height={size} width={size} />
);

export const LogoGoogle: FC<LogoProps> = ({ size = 16 }) => (
  <GoogleSvg height={size} width={size} />
);

export const LogoAnthropic: FC<LogoProps> = ({ size = 16 }) => (
  <AnthropicSvg height={size} width={size} />
);

export const LogoXai: FC<LogoProps> = ({ size = 16 }) => (
  <XaiSvg height={size} width={size} />
);

export const LogoBFL: FC<LogoProps> = ({ size = 16 }) => (
  <BflSvg height={size} width={size} />
);

export const LogoRecraft: FC<LogoProps> = ({ size = 16 }) => (
  <RecraftSvg height={size} width={size} />
);

export const LogoKling: FC<LogoProps> = ({ size = 16 }) => (
  <KlingSvg height={size} width={size} />
);

/** Provider id (lib/ai/models.ts) → brand logo component. */
export const providerLogos: Record<ModelProvider, FC<LogoProps>> = {
  openai: LogoOpenAI,
  google: LogoGoogle,
  anthropic: LogoAnthropic,
  xai: LogoXai,
  bfl: LogoBFL,
  recraft: LogoRecraft,
  klingai: LogoKling,
};
