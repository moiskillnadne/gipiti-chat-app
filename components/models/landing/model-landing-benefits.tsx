import {
  Code,
  FileText,
  Globe,
  type LucideIcon,
  PenLine,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";

import type {
  LandingBenefitIcon,
  ModelLanding,
} from "@/lib/marketing/model-landings";

import { accentClasses } from "./accent-styles";
import { ModelLandingSectionHead } from "./model-landing-section-head";

const benefitIcons: Record<LandingBenefitIcon, LucideIcon> = {
  sparkles: Sparkles,
  "file-text": FileText,
  code: Code,
  zap: Zap,
  pen: PenLine,
  scale: Scale,
  wallet: Wallet,
  shield: ShieldCheck,
  search: Search,
  globe: Globe,
};

export const ModelLandingBenefits = ({
  landing,
}: {
  landing: ModelLanding;
}) => {
  const accent = accentClasses[landing.accent];

  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <ModelLandingSectionHead
          sub="Чем модель выделяется и за что её выбирают для работы с текстом"
          title={`Почему выбирают ${landing.name}`}
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {landing.benefits.map((benefit) => {
            const BenefitIcon = benefitIcons[benefit.icon];

            return (
              <div
                className="rounded-[18px] border border-zinc-800 bg-zinc-900/55 p-6"
                key={benefit.title}
              >
                <div
                  className={`flex size-11 items-center justify-center rounded-xl text-white ${accent.iconTile}`}
                >
                  <BenefitIcon className="size-5" />
                </div>
                <h3 className="mt-4.5 mb-2.5 font-semibold text-lg text-white">
                  {benefit.title}
                </h3>
                <p className="text-[14.5px] text-zinc-400 leading-relaxed">
                  {benefit.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
