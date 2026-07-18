import type { ModelLanding } from "@/lib/marketing/model-landings";

import { accentClasses } from "./accent-styles";
import { EmphasizedText } from "./emphasized-text";
import { ModelLandingSectionHead } from "./model-landing-section-head";

export const ModelLandingAudience = ({
  landing,
}: {
  landing: ModelLanding;
}) => {
  const accent = accentClasses[landing.accent];

  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <ModelLandingSectionHead
          sub="Инструмент для всех, кто каждый день работает с текстом и документами"
          title={`Кому подойдёт ${landing.name}`}
        />
        <div className="grid gap-6 md:grid-cols-3">
          {landing.audience.map((card) => (
            <div key={card.title}>
              <div className="flex h-60 flex-col gap-2.5 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/55 p-4.5">
                <div
                  className={`max-w-[88%] self-end rounded-[13px] rounded-br-[3px] px-3.5 py-2.5 text-[12.5px] text-white leading-normal ${accent.userBubble}`}
                >
                  {card.userMessage}
                </div>
                <div className="max-w-[92%] self-start rounded-[13px] rounded-tl-[3px] border border-zinc-800 bg-white/4 px-3.5 py-2.5 text-[12.5px] text-zinc-300 leading-normal">
                  <EmphasizedText text={card.aiReply} />
                </div>
              </div>
              <h3 className="mt-5 mb-2.5 text-center font-semibold text-[19px] text-white">
                {card.title}
              </h3>
              <p className="text-center text-[14.5px] text-zinc-400 leading-relaxed">
                {card.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
