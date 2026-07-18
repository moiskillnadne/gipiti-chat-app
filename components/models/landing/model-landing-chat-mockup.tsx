import type { ModelLanding } from "@/lib/marketing/model-landings";

import { accentClasses } from "./accent-styles";
import { EmphasizedText } from "./emphasized-text";

/** Static browser/chat mockup for the landing hero (design: nb-browser). */
export const ModelLandingChatMockup = ({
  landing,
}: {
  landing: ModelLanding;
}) => {
  const accent = accentClasses[landing.accent];
  const lastBullet = landing.heroChat.aiBullets.at(-1);

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className={`-inset-x-[10%] -inset-y-[20%] pointer-events-none absolute ${accent.heroGlow}`}
      />
      <div className="relative overflow-hidden rounded-[18px] border border-zinc-700 bg-zinc-900/70 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-4 border-zinc-800 border-b px-4 py-3">
          <div aria-hidden="true" className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-zinc-700" />
            <span className="size-2.5 rounded-full bg-zinc-700" />
            <span className="size-2.5 rounded-full bg-zinc-700" />
          </div>
          <div className="hidden max-w-60 flex-1 truncate rounded-full bg-zinc-900 px-4 py-1.5 text-center text-[13px] text-zinc-400 sm:mx-auto sm:block">
            gipiti.ru/chat
          </div>
          <span
            className={`ml-auto rounded-full px-3 py-1 text-[12.5px] sm:ml-0 ${accent.modelTag}`}
          >
            {landing.name}
          </span>
        </div>

        <div className="flex flex-col gap-4 p-6">
          <div
            className={`max-w-[78%] self-end rounded-2xl rounded-br-[4px] px-4 py-3 text-[14.5px] text-white leading-normal ${accent.userBubble}`}
          >
            {landing.heroChat.userMessage}
          </div>

          <div className="flex w-[88%] flex-col gap-2 self-start sm:w-[78%]">
            <span className="text-xs text-zinc-500">{landing.name}</span>
            <div className="rounded-2xl rounded-tl-[4px] border border-zinc-800 bg-white/4 px-4 py-3 text-sm text-zinc-300 leading-relaxed">
              <EmphasizedText text={landing.heroChat.aiIntro} />
              <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4">
                {landing.heroChat.aiBullets.map((bullet) => (
                  <li key={bullet}>
                    <EmphasizedText text={bullet} />
                    {bullet === lastBullet ? (
                      <span
                        aria-hidden="true"
                        className={`ml-1 inline-block h-3.5 w-2 animate-pulse rounded-[2px] align-middle ${accent.cursor}`}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-1.5 flex items-center gap-3 rounded-full border border-zinc-700 py-2.5 pr-2.5 pl-5">
            <span className="flex-1 truncate text-sm text-zinc-500">
              Спросите {landing.name} о чём угодно…
            </span>
            <div
              aria-hidden="true"
              className={`flex size-8.5 flex-none items-center justify-center rounded-full text-[15px] text-white ${accent.sendButton}`}
            >
              ➤
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
