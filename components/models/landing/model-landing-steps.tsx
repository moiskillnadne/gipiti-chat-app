import type { ModelLanding } from "@/lib/marketing/model-landings";
import { sectionCopy } from "@/lib/marketing/model-landings";

import { accentClasses } from "./accent-styles";
import { ModelLandingSectionHead } from "./model-landing-section-head";

export const ModelLandingSteps = ({ landing }: { landing: ModelLanding }) => {
  const accent = accentClasses[landing.accent];
  const lastStep = landing.steps.at(-1);

  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <ModelLandingSectionHead
          sub={sectionCopy[landing.kind].stepsSub}
          title={`Как начать работу с ${landing.name}`}
        />
        <div className="grid gap-9 text-center md:grid-cols-4 md:gap-8">
          {landing.steps.map((step, position) => (
            <div className="relative" key={step.title}>
              <div
                className={`mx-auto mb-5 flex size-14 items-center justify-center rounded-full font-bold text-white text-xl shadow-lg ${accent.stepNumber}`}
              >
                {position + 1}
              </div>
              {step === lastStep ? null : (
                <div
                  aria-hidden="true"
                  className={`absolute top-7 left-[calc(50%+44px)] hidden h-px w-[calc(100%-88px)] md:block ${accent.stepConnector}`}
                />
              )}
              <h3 className="mb-2.5 font-semibold text-lg text-white">
                {step.title}
              </h3>
              <p className="mx-auto max-w-60 text-sm text-zinc-400 leading-relaxed">
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
