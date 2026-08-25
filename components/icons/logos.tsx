import type { FC } from "react";

import type { ModelProvider } from "@/lib/ai/models";

import AlibabaSvg from "./logos/alibaba.svg";
import AnthropicSvg from "./logos/anthropic.svg";
import BflSvg from "./logos/bfl.svg";
import BytedanceSvg from "./logos/bytedance.svg";
import DeepseekSvg from "./logos/deepseek.svg";
import GoogleSvg from "./logos/google.svg";
import KlingSvg from "./logos/klingai.svg";
import MoonshotSvg from "./logos/moonshotai.svg";
import OpenAiSvg from "./logos/openai.svg";
import PerplexitySvg from "./logos/perplexity.svg";
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

export const LogoBytedance: FC<LogoProps> = ({ size = 16 }) => (
  <BytedanceSvg height={size} width={size} />
);

export const LogoDeepseek: FC<LogoProps> = ({ size = 16 }) => (
  <DeepseekSvg height={size} width={size} />
);

export const LogoPerplexity: FC<LogoProps> = ({ size = 16 }) => (
  <PerplexitySvg height={size} width={size} />
);

export const LogoMoonshot: FC<LogoProps> = ({ size = 16 }) => (
  <MoonshotSvg height={size} width={size} />
);

export const LogoAlibaba: FC<LogoProps> = ({ size = 16 }) => (
  <AlibabaSvg height={size} width={size} />
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
  bytedance: LogoBytedance,
  deepseek: LogoDeepseek,
  perplexity: LogoPerplexity,
  moonshotai: LogoMoonshot,
  alibaba: LogoAlibaba,
};
