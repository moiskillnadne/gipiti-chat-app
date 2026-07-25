/**
 * Types for per-model landing pages under /models/{slug}.
 *
 * Landings mirror the "Model Landing - Text Model" Claude Design template:
 * each one is keyed to a real model id from `lib/ai/models.ts` and rendered by
 * `components/models/landing/*`. Copy is hardcoded Russian, matching the rest
 * of the marketing surface (see `models-catalog.ts`).
 *
 * Image and video models reuse the same page skeleton but swap the hero
 * mockup and the result tiles — see `LandingHeroMedia` and `ModelLanding`.
 */

/** Which surface the model produces — drives the hero mockup and section copy. */
export type LandingKind = "text" | "image" | "video";

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
  | "globe"
  | "image"
  | "video"
  | "wand"
  | "layers"
  | "ratio"
  | "volume"
  | "download"
  | "palette";

export type LandingBenefit = {
  icon: LandingBenefitIcon;
  title: string;
  text: string;
};

export type LandingStep = {
  title: string;
  text: string;
};

/**
 * Chat snippets support `**bold**` emphasis, parsed by `parseEmphasis`.
 *
 * On image and video landings `aiReply` is the caption laid over the mock
 * result tile instead of a reply bubble.
 */
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

/** Shape of the mock result frame; wider ratios are rendered as 16:9. */
export type LandingMediaAspect = "16:9" | "1:1" | "9:16";

/** Hero mockup for image and video landings: a prompt plus a result frame. */
export type LandingHeroMedia = {
  userMessage: string;
  /** Model's line above the frame; supports `**bold**`. */
  aiIntro: string;
  aspect: LandingMediaAspect;
  /** Scene description laid over the frame. */
  resultCaption: string;
  /** Meta line under the frame, e.g. "2K · 16:9 · 12 сек". */
  resultMeta: string;
};

type ModelLandingBase = {
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
  benefits: LandingBenefit[];
  steps: LandingStep[];
  audience: LandingAudienceCard[];
  faq: LandingFaqItem[];
  otherModels: LandingModelChip[];
};

export type TextModelLanding = ModelLandingBase & {
  kind: "text";
  heroChat: LandingHeroChat;
};

export type MediaModelLanding = ModelLandingBase & {
  kind: "image" | "video";
  heroMedia: LandingHeroMedia;
};

export type ModelLanding = TextModelLanding | MediaModelLanding;
