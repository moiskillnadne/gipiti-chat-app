import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import type { ModelLanding } from "@/lib/marketing/model-landings";

import { ModelLandingAudience } from "./model-landing-audience";
import { ModelLandingBenefits } from "./model-landing-benefits";
import { ModelLandingCta } from "./model-landing-cta";
import { ModelLandingFaq } from "./model-landing-faq";
import { ModelLandingHero } from "./model-landing-hero";
import { ModelLandingOtherModels } from "./model-landing-other-models";
import { ModelLandingSteps } from "./model-landing-steps";

/** Full per-model landing page body (design: Model Landing - Text Model, variant A). */
export const ModelLandingView = ({ landing }: { landing: ModelLanding }) => (
  <div className="min-h-screen bg-zinc-950">
    <LandingNav />
    <main className="pt-20">
      <ModelLandingHero landing={landing} />
      <ModelLandingBenefits landing={landing} />
      <ModelLandingSteps landing={landing} />
      <ModelLandingAudience landing={landing} />
      <ModelLandingFaq
        accent={landing.accent}
        items={landing.faq}
        modelName={landing.name}
      />
      <ModelLandingOtherModels landing={landing} />
      <ModelLandingCta landing={landing} />
    </main>
    <LandingFooter />
  </div>
);
