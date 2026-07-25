import type {
  LandingAudienceCard,
  ModelLanding,
} from "@/lib/marketing/model-landings";
import { sectionCopy } from "@/lib/marketing/model-landings";

import { accentClasses } from "./accent-styles";
import { EmphasizedText } from "./emphasized-text";
import { MediaResultFrame } from "./media-result-frame";
import { ModelLandingSectionHead } from "./model-landing-section-head";

type AudienceMockProps = {
  card: LandingAudienceCard;
  landing: ModelLanding;
};

/**
 * The card mock swaps by what the model produces: a reply bubble for text
 * models, a result frame captioned with `aiReply` for image and video ones.
 */
const AudienceMock = ({ card, landing }: AudienceMockProps) => {
  const accent = accentClasses[landing.accent];

  return (
    <div className="flex h-60 flex-col gap-2.5 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/55 p-4.5">
      <div
        className={`max-w-[88%] self-end rounded-[13px] rounded-br-[3px] px-3.5 py-2.5 text-[12.5px] text-white leading-normal ${accent.userBubble}`}
      >
        {card.userMessage}
      </div>

      {landing.kind === "text" ? (
        <div className="max-w-[92%] self-start rounded-[13px] rounded-tl-[3px] border border-zinc-800 bg-white/4 px-3.5 py-2.5 text-[12.5px] text-zinc-300 leading-normal">
          <EmphasizedText text={card.aiReply} />
        </div>
      ) : (
        <MediaResultFrame
          accent={landing.accent}
          caption={card.aiReply}
          captionClassName="text-[11.5px]"
          isVideo={landing.kind === "video"}
          sizeClassName="w-full flex-1"
        />
      )}
    </div>
  );
};

export const ModelLandingAudience = ({
  landing,
}: {
  landing: ModelLanding;
}) => (
  <section className="px-4 py-16">
    <div className="mx-auto max-w-6xl">
      <ModelLandingSectionHead
        sub={sectionCopy[landing.kind].audienceSub}
        title={`Кому подойдёт ${landing.name}`}
      />
      <div className="grid gap-6 md:grid-cols-3">
        {landing.audience.map((card) => (
          <div key={card.title}>
            <AudienceMock card={card} landing={landing} />
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
