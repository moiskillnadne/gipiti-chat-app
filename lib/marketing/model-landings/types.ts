/**
 * Types for per-model landing pages under /models/{slug}.
 *
 * Landings mirror the "Model Landing - Text Model" Claude Design template:
 * each one is keyed to a real model id from `lib/ai/models.ts` and rendered by
 * `components/models/landing/*`. Copy is hardcoded Russian, matching the rest
 * of the marketing surface (see `models-catalog.ts`).
 */

export type ModelLandingAccent =
  | "indigo"
  | "emerald"
  | "warm"
  | "rose"
  | "sky"
  | "teal"
  | "violet"
  | "blue";

export type LandingBenefitIcon =
  | "sparkles"
  | "file-text"
  | "code"
  | "zap"
  | "pen"
  | "scale"
  | "wallet"
  | "shield"
  | "search"
  | "globe";

export type LandingBenefit = {
  icon: LandingBenefitIcon;
  title: string;
  text: string;
};

export type LandingStep = {
  title: string;
  text: string;
};

/** Chat snippets support `**bold**` emphasis, parsed by `parseEmphasis`. */
export type LandingAudienceCard = {
  title: string;
  text: string;
  userMessage: string;
  aiReply: string;
};

export type LandingFaqItem = {
  question: string;
  answer: string;
};

export type LandingModelChip = {
  name: string;
  tag: string;
  href: string;
};

export type LandingHeroChat = {
  userMessage: string;
  aiIntro: string;
  aiBullets: string[];
};

export type ModelLanding = {
  /** Path segment of the landing page: /models/{slug} */
  slug: string;
  /** Model id from `lib/ai/models.ts` */
  modelId: string;
  name: string;
  vendor: string;
  accent: ModelLandingAccent;
  badge: string;
  h1Top: string;
  h1Gradient: string;
  sub: string;
  ctaMain: string;
  metaTitle: string;
  metaDescription: string;
  heroChat: LandingHeroChat;
  benefits: LandingBenefit[];
  steps: LandingStep[];
  audience: LandingAudienceCard[];
  faq: LandingFaqItem[];
  otherModels: LandingModelChip[];
};
