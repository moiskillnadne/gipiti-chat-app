import { useTranslations } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { CardIcon, LockIcon, RefreshIcon } from "./plan-icons";

const TRUST_ITEMS = [
  { key: "secure", Icon: LockIcon },
  { key: "cards", Icon: CardIcon },
  { key: "cancel", Icon: RefreshIcon },
] as const;

export function TrustRow() {
  const t = useTranslations("auth.subscription.plansPage.trust");

  return (
    <div className="mx-auto grid w-full max-w-[880px] grid-cols-1 overflow-hidden rounded-[14px] border border-rule bg-card md:grid-cols-3">
      {TRUST_ITEMS.map(({ key, Icon }, index) => (
        <div
          className={cn(
            "flex items-center gap-[13px] px-6 py-5",
            index > 0 && "border-rule border-t md:border-t-0 md:border-l"
          )}
          key={key}
        >
          <span className="grid size-[38px] shrink-0 place-items-center rounded-[10px] bg-paper-2 text-ink-2">
            <Icon className="size-[18px]" />
          </span>
          <span className="flex flex-col gap-px">
            <b className="whitespace-nowrap font-medium text-[14px] text-ink">
              {t(`${key}Label`)}
            </b>
            <span className="whitespace-nowrap text-[12.5px] text-ink-3">
              {t(`${key}Sub`)}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
