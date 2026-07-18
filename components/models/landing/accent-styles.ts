import type { ModelLandingAccent } from "@/lib/marketing/model-landings";

/**
 * Per-accent Tailwind class tokens for model landing pages. Full literal
 * strings so Tailwind's scanner picks every class up. Hexes follow the design
 * accent presets: indigo (brand), emerald (GPT), warm (flagship).
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
  },
};
