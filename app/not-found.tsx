import { HomeIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getTranslations } from "@/lib/i18n/translate";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  const tErrors = await getTranslations("errors");

  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <title>{`${t("metaTitle")} | GIPITI`}</title>

      <header className="flex flex-shrink-0 items-center justify-between px-5 py-[22px] sm:px-12">
        <Link
          className="group inline-flex items-center gap-[7px] font-mono text-[11px] text-ink-3 uppercase tracking-[0.09em] no-underline transition-colors hover:text-ink"
          href="/legal/support"
        >
          <span className="size-[5px] rounded-full bg-ink-4 transition-colors group-hover:bg-citrus-deep" />
          <span className="hidden sm:inline">{t("support")}</span>
        </Link>
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center px-5 pb-14 sm:px-12">
        <div className="relative flex w-full max-w-[600px] flex-col items-center text-center">
          <div
            aria-hidden="true"
            className="-translate-x-1/2 pointer-events-none absolute top-[-40px] left-1/2"
            style={{
              width: "min(560px, 90vw)",
              height: 320,
              opacity: 0.55,
              filter: "blur(8px)",
              background:
                "radial-gradient(ellipse at center, color-mix(in oklab, var(--citrus) 30%, transparent), transparent 68%)",
            }}
          />

          <div
            className="relative z-[1] mb-3.5 inline-flex animate-notfound-reveal items-center gap-2.5 whitespace-nowrap font-medium font-mono text-[11px] text-ink-3 uppercase tracking-[0.16em]"
            style={{ animationDelay: "0.05s" }}
          >
            <span className="h-px w-[26px] bg-rule-strong" />
            {t("eyebrow")}
            <span className="h-px w-[26px] bg-rule-strong" />
          </div>

          <div
            className="relative z-[1] animate-notfound-reveal font-light text-ink leading-[0.92] tracking-[-0.04em]"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(112px, 26vw, 220px)",
              animationDelay: "0.14s",
            }}
          >
            4<span className="font-normal text-citrus-deep italic">0</span>4
          </div>

          <div className="relative z-[1] mt-[34px] flex w-full flex-col gap-3.5 text-left">
            <div
              className="flex animate-notfound-reveal items-end justify-end gap-[11px]"
              style={{ animationDelay: "0.23s" }}
            >
              <div className="max-w-[88%] rounded-2xl rounded-br-[5px] bg-ink px-[15px] py-[11px] text-[14px] text-paper leading-[1.55] sm:max-w-[84%] sm:text-[15px]">
                {t("userMessage")}
                <span className="mt-[7px] block font-mono text-[10px] text-ink-4 uppercase tracking-[0.06em]">
                  {t("userMeta")}
                </span>
              </div>
            </div>

            <div
              className="flex animate-notfound-reveal items-end gap-[11px]"
              style={{ animationDelay: "0.32s" }}
            >
              <div
                aria-hidden="true"
                className="flex size-8 shrink-0 animate-assistant-glow items-center justify-center rounded-full border border-rule bg-paper text-citrus-deep"
              >
                <svg
                  aria-hidden="true"
                  className="size-[15px]"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2.5l1.6 4.7a4 4 0 0 0 2.5 2.5l4.7 1.6-4.7 1.6a4 4 0 0 0-2.5 2.5L12 20.1l-1.6-4.7a4 4 0 0 0-2.5-2.5L3.2 11.3l4.7-1.6a4 4 0 0 0 2.5-2.5L12 2.5z" />
                </svg>
              </div>
              <div className="max-w-[88%] rounded-2xl rounded-bl-[5px] border border-rule bg-card px-[15px] py-[11px] text-[14px] text-ink-2 leading-[1.55] shadow-sm sm:max-w-[84%] sm:text-[15px]">
                {t("assistantLead")}
                <b className="font-medium text-ink">{t("assistantStrong")}</b>
                {t("assistantTail")}
                <span className="mt-[7px] block font-mono text-[10px] text-ink-4 uppercase tracking-[0.06em]">
                  {t("assistantMeta")}
                </span>
              </div>
            </div>
          </div>

          <div
            className="relative z-[1] mt-[30px] w-full animate-notfound-reveal sm:w-auto"
            style={{ animationDelay: "0.41s" }}
          >
            <Button asChild className="w-full sm:w-auto" size="lg">
              <Link href="/">
                <HomeIcon />
                {tErrors("goHome")}
              </Link>
            </Button>
          </div>
        </div>
      </main>

      <footer className="flex flex-shrink-0 justify-center px-5 pb-[26px] sm:px-12">
        <div className="inline-flex items-center gap-[7px] whitespace-nowrap font-mono text-[10px] text-ink-4 tracking-[0.06em] sm:gap-2.5 sm:text-[11px]">
          <span>{"HTTP 404"}</span>
          <span className="text-rule-strong">/</span>
          <span>NOT FOUND</span>
          <span className="text-rule-strong">/</span>
          <span>gipiti.ru</span>
        </div>
      </footer>
    </div>
  );
}
