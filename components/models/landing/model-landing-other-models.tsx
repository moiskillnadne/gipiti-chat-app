import Link from "next/link";

import type { ModelLanding } from "@/lib/marketing/model-landings";

import { accentClasses } from "./accent-styles";
import { ModelLandingSectionHead } from "./model-landing-section-head";

export const ModelLandingOtherModels = ({
  landing,
}: {
  landing: ModelLanding;
}) => {
  const accent = accentClasses[landing.accent];

  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <ModelLandingSectionHead
          sub="Все 30+ моделей доступны в одной подписке — переключайтесь в один клик"
          title="Другие модели в GIPITI"
        />
        <div className="flex flex-wrap justify-center gap-3.5">
          {landing.otherModels.map((chip) => (
            <Link
              className={`flex flex-col gap-0.5 rounded-[14px] border border-zinc-800 bg-zinc-900/55 px-5.5 py-3.5 transition-colors ${accent.chipHover}`}
              href={chip.href}
              key={chip.name}
            >
              <b className="font-semibold text-[15px] text-white">
                {chip.name}
              </b>
              <span className="text-[12.5px] text-zinc-500">{chip.tag}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};
