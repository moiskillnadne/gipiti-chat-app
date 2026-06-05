import { Button } from "@/components/ui/button";
import { ArrowIcon, CheckIcon } from "./plan-icons";

export type PlanFeature = {
  label: string;
  sub: string;
};

type PlanCardFullProps = {
  name: string;
  priceAmount: string;
  currency: string;
  period: string;
  description: string;
  whatsIncludedLabel: string;
  ctaLabel: string;
  loadingLabel: string;
  features: PlanFeature[];
  isLoading: boolean;
  onSubscribe: () => void;
};

export function PlanCardFull({
  name,
  priceAmount,
  currency,
  period,
  description,
  whatsIncludedLabel,
  ctaLabel,
  loadingLabel,
  features,
  isLoading,
  onSubscribe,
}: PlanCardFullProps) {
  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col rounded-[22px] border-[1.5px] border-ink bg-card p-8 shadow-[0_24px_60px_-32px_rgba(20,22,26,0.28)]">
      <div className="mb-[18px]">
        <div className="font-semibold text-[22px] text-ink tracking-[-0.02em]">
          {name}
        </div>
      </div>

      <div className="mb-5 flex items-baseline gap-1 border-rule-strong border-b border-dashed pb-5">
        <span
          className="text-[60px] text-ink leading-[0.9] tracking-[-0.02em]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {priceAmount}
        </span>
        <span
          className="text-[28px] text-ink-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {currency}
        </span>
        <span className="ml-1.5 self-center font-mono text-[12px] text-ink-3 uppercase tracking-[0.06em]">
          {period}
        </span>
      </div>

      <p className="mb-[22px] text-[15px] text-ink-2 leading-[1.5]">
        {description}
      </p>

      <Button
        className="group w-full rounded-md text-[15px]"
        disabled={isLoading}
        onClick={onSubscribe}
        size="lg"
        type="button"
        variant="default"
      >
        {isLoading ? (
          loadingLabel
        ) : (
          <>
            {ctaLabel}
            <ArrowIcon className="size-4 transition-transform duration-base ease-canon group-hover:translate-x-[3px]" />
          </>
        )}
      </Button>

      <div className="mt-[26px] mb-[18px] flex items-center gap-[14px]">
        <span className="h-px flex-1 bg-rule" />
        <span className="font-mono text-[10px] text-ink-3 uppercase tracking-[0.12em]">
          {whatsIncludedLabel}
        </span>
        <span className="h-px flex-1 bg-rule" />
      </div>

      <ul className="flex flex-col gap-[15px]">
        {features.map((feature) => (
          <li
            className="grid grid-cols-[auto_1fr] items-start gap-3"
            key={feature.label}
          >
            <span className="mt-px grid size-[22px] place-items-center rounded-full bg-citrus-soft text-citrus-deep">
              <CheckIcon className="size-[13px]" />
            </span>
            <span className="flex min-w-0 flex-col gap-px">
              <b className="font-medium text-[14.5px] text-ink">
                {feature.label}
              </b>
              <span className="text-[13px] text-ink-3 leading-[1.4]">
                {feature.sub}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
