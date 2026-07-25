import type { ModelLandingAccent } from "@/lib/marketing/model-landings";

/**
 * Per-accent Tailwind class tokens for model landing pages. Full literal
 * strings so Tailwind's scanner picks every class up. The first three accents
 * follow the design presets (indigo/emerald/warm); the rest extend the same
 * scheme so each vendor family gets a distinct hue.
 */
export type AccentClasses = {
  badge: string;
  gradientText: string;
  primaryButton: string;
  iconTile: string;
  stepNumber: string;
  stepConnector: string;
  userBubble: string;
  modelTag: string;
  faqOpenBorder: string;
  chipHover: string;
  cardHover: string;
  ctaBorder: string;
  ctaGlow: string;
  heroGlow: string;
  cursor: string;
  sendButton: string;
  /** Gradient filling the mock result frame on image/video landings. */
  mediaCanvas: string;
};

export const accentClasses: Record<ModelLandingAccent, AccentClasses> = {
  indigo: {
    badge: "border-indigo-500/35 bg-indigo-500/10 text-indigo-300",
    gradientText: "bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400",
    primaryButton:
      "bg-gradient-to-r from-indigo-500 to-purple-600 shadow-indigo-500/30 hover:shadow-indigo-500/40",
    iconTile: "bg-gradient-to-br from-indigo-500 to-purple-600",
    stepNumber:
      "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/35",
    stepConnector: "bg-purple-400/40",
    userBubble: "bg-indigo-500/25",
    modelTag: "bg-indigo-500/15 text-indigo-300",
    faqOpenBorder: "border-indigo-500/40",
    chipHover: "hover:border-indigo-500/45",
    cardHover: "hover:border-indigo-500/45",
    ctaBorder: "border-purple-500/35",
    ctaGlow:
      "bg-[radial-gradient(ellipse_at_50%_0%,rgba(168,85,247,0.22),transparent_55%)]",
    heroGlow:
      "bg-[radial-gradient(ellipse_at_70%_30%,rgba(168,85,247,0.16),transparent_60%)]",
    cursor: "bg-gradient-to-b from-indigo-400 to-purple-400",
    sendButton: "bg-gradient-to-br from-indigo-500 to-purple-600",
    mediaCanvas: "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500",
  },
  emerald: {
    badge: "border-emerald-500/35 bg-emerald-500/10 text-emerald-300",
    gradientText:
      "bg-gradient-to-r from-emerald-400 via-cyan-300 to-indigo-300",
    primaryButton:
      "bg-gradient-to-r from-emerald-500 to-cyan-600 shadow-emerald-500/30 hover:shadow-emerald-500/40",
    iconTile: "bg-gradient-to-br from-emerald-500 to-cyan-600",
    stepNumber:
      "bg-gradient-to-br from-emerald-500 to-cyan-600 shadow-emerald-500/35",
    stepConnector: "bg-cyan-400/40",
    userBubble: "bg-emerald-500/25",
    modelTag: "bg-emerald-500/15 text-emerald-300",
    faqOpenBorder: "border-emerald-500/40",
    chipHover: "hover:border-emerald-500/45",
    cardHover: "hover:border-emerald-500/45",
    ctaBorder: "border-cyan-500/35",
    ctaGlow:
      "bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,211,238,0.18),transparent_55%)]",
    heroGlow:
      "bg-[radial-gradient(ellipse_at_70%_30%,rgba(34,211,238,0.14),transparent_60%)]",
    cursor: "bg-gradient-to-b from-emerald-400 to-cyan-400",
    sendButton: "bg-gradient-to-br from-emerald-500 to-cyan-600",
    mediaCanvas: "bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500",
  },
  warm: {
    badge: "border-amber-500/35 bg-amber-500/10 text-amber-300",
    gradientText: "bg-gradient-to-r from-amber-300 via-orange-400 to-red-400",
    primaryButton:
      "bg-gradient-to-r from-amber-500 to-orange-600 shadow-amber-500/30 hover:shadow-amber-500/40",
    iconTile: "bg-gradient-to-br from-amber-500 to-orange-600",
    stepNumber:
      "bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/35",
    stepConnector: "bg-orange-400/40",
    userBubble: "bg-amber-500/25",
    modelTag: "bg-amber-500/15 text-amber-300",
    faqOpenBorder: "border-amber-500/40",
    chipHover: "hover:border-amber-500/45",
    cardHover: "hover:border-amber-500/45",
    ctaBorder: "border-orange-500/35",
    ctaGlow:
      "bg-[radial-gradient(ellipse_at_50%_0%,rgba(249,115,22,0.2),transparent_55%)]",
    heroGlow:
      "bg-[radial-gradient(ellipse_at_70%_30%,rgba(249,115,22,0.15),transparent_60%)]",
    cursor: "bg-gradient-to-b from-amber-400 to-orange-400",
    sendButton: "bg-gradient-to-br from-amber-500 to-orange-600",
    mediaCanvas: "bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500",
  },
  rose: {
    badge: "border-rose-500/35 bg-rose-500/10 text-rose-300",
    gradientText: "bg-gradient-to-r from-rose-400 via-pink-400 to-fuchsia-400",
    primaryButton:
      "bg-gradient-to-r from-rose-500 to-pink-600 shadow-rose-500/30 hover:shadow-rose-500/40",
    iconTile: "bg-gradient-to-br from-rose-500 to-pink-600",
    stepNumber:
      "bg-gradient-to-br from-rose-500 to-pink-600 shadow-rose-500/35",
    stepConnector: "bg-pink-400/40",
    userBubble: "bg-rose-500/25",
    modelTag: "bg-rose-500/15 text-rose-300",
    faqOpenBorder: "border-rose-500/40",
    chipHover: "hover:border-rose-500/45",
    cardHover: "hover:border-rose-500/45",
    ctaBorder: "border-pink-500/35",
    ctaGlow:
      "bg-[radial-gradient(ellipse_at_50%_0%,rgba(236,72,153,0.2),transparent_55%)]",
    heroGlow:
      "bg-[radial-gradient(ellipse_at_70%_30%,rgba(236,72,153,0.15),transparent_60%)]",
    cursor: "bg-gradient-to-b from-rose-400 to-pink-400",
    sendButton: "bg-gradient-to-br from-rose-500 to-pink-600",
    mediaCanvas: "bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500",
  },
  sky: {
    badge: "border-sky-500/35 bg-sky-500/10 text-sky-300",
    gradientText: "bg-gradient-to-r from-sky-300 via-sky-400 to-blue-400",
    primaryButton:
      "bg-gradient-to-r from-sky-500 to-blue-600 shadow-sky-500/30 hover:shadow-sky-500/40",
    iconTile: "bg-gradient-to-br from-sky-500 to-blue-600",
    stepNumber: "bg-gradient-to-br from-sky-500 to-blue-600 shadow-sky-500/35",
    stepConnector: "bg-sky-400/40",
    userBubble: "bg-sky-500/25",
    modelTag: "bg-sky-500/15 text-sky-300",
    faqOpenBorder: "border-sky-500/40",
    chipHover: "hover:border-sky-500/45",
    cardHover: "hover:border-sky-500/45",
    ctaBorder: "border-blue-500/35",
    ctaGlow:
      "bg-[radial-gradient(ellipse_at_50%_0%,rgba(56,189,248,0.18),transparent_55%)]",
    heroGlow:
      "bg-[radial-gradient(ellipse_at_70%_30%,rgba(56,189,248,0.14),transparent_60%)]",
    cursor: "bg-gradient-to-b from-sky-400 to-blue-400",
    sendButton: "bg-gradient-to-br from-sky-500 to-blue-600",
    mediaCanvas: "bg-gradient-to-br from-sky-400 via-sky-500 to-blue-600",
  },
  teal: {
    badge: "border-teal-500/35 bg-teal-500/10 text-teal-300",
    gradientText: "bg-gradient-to-r from-teal-300 via-cyan-400 to-sky-400",
    primaryButton:
      "bg-gradient-to-r from-teal-500 to-cyan-600 shadow-teal-500/30 hover:shadow-teal-500/40",
    iconTile: "bg-gradient-to-br from-teal-500 to-cyan-600",
    stepNumber:
      "bg-gradient-to-br from-teal-500 to-cyan-600 shadow-teal-500/35",
    stepConnector: "bg-cyan-400/40",
    userBubble: "bg-teal-500/25",
    modelTag: "bg-teal-500/15 text-teal-300",
    faqOpenBorder: "border-teal-500/40",
    chipHover: "hover:border-teal-500/45",
    cardHover: "hover:border-teal-500/45",
    ctaBorder: "border-cyan-500/35",
    ctaGlow:
      "bg-[radial-gradient(ellipse_at_50%_0%,rgba(45,212,191,0.18),transparent_55%)]",
    heroGlow:
      "bg-[radial-gradient(ellipse_at_70%_30%,rgba(45,212,191,0.14),transparent_60%)]",
    cursor: "bg-gradient-to-b from-teal-400 to-cyan-400",
    sendButton: "bg-gradient-to-br from-teal-500 to-cyan-600",
    mediaCanvas: "bg-gradient-to-br from-teal-400 via-cyan-500 to-sky-500",
  },
  violet: {
    badge: "border-violet-500/35 bg-violet-500/10 text-violet-300",
    gradientText:
      "bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400",
    primaryButton:
      "bg-gradient-to-r from-violet-500 to-fuchsia-600 shadow-violet-500/30 hover:shadow-violet-500/40",
    iconTile: "bg-gradient-to-br from-violet-500 to-fuchsia-600",
    stepNumber:
      "bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-violet-500/35",
    stepConnector: "bg-fuchsia-400/40",
    userBubble: "bg-violet-500/25",
    modelTag: "bg-violet-500/15 text-violet-300",
    faqOpenBorder: "border-violet-500/40",
    chipHover: "hover:border-violet-500/45",
    cardHover: "hover:border-violet-500/45",
    ctaBorder: "border-fuchsia-500/35",
    ctaGlow:
      "bg-[radial-gradient(ellipse_at_50%_0%,rgba(217,70,239,0.2),transparent_55%)]",
    heroGlow:
      "bg-[radial-gradient(ellipse_at_70%_30%,rgba(217,70,239,0.15),transparent_60%)]",
    cursor: "bg-gradient-to-b from-violet-400 to-fuchsia-400",
    sendButton: "bg-gradient-to-br from-violet-500 to-fuchsia-600",
    mediaCanvas:
      "bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500",
  },
  blue: {
    badge: "border-blue-500/35 bg-blue-500/10 text-blue-300",
    gradientText: "bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400",
    primaryButton:
      "bg-gradient-to-r from-blue-500 to-indigo-600 shadow-blue-500/30 hover:shadow-blue-500/40",
    iconTile: "bg-gradient-to-br from-blue-500 to-indigo-600",
    stepNumber:
      "bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/35",
    stepConnector: "bg-indigo-400/40",
    userBubble: "bg-blue-500/25",
    modelTag: "bg-blue-500/15 text-blue-300",
    faqOpenBorder: "border-blue-500/40",
    chipHover: "hover:border-blue-500/45",
    cardHover: "hover:border-blue-500/45",
    ctaBorder: "border-indigo-500/35",
    ctaGlow:
      "bg-[radial-gradient(ellipse_at_50%_0%,rgba(99,102,241,0.22),transparent_55%)]",
    heroGlow:
      "bg-[radial-gradient(ellipse_at_70%_30%,rgba(99,102,241,0.16),transparent_60%)]",
    cursor: "bg-gradient-to-b from-blue-400 to-indigo-400",
    sendButton: "bg-gradient-to-br from-blue-500 to-indigo-600",
    mediaCanvas: "bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500",
  },
};
