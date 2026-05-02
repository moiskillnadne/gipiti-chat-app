"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "@/lib/i18n/translate";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription/subscription-tiers";
import styles from "./dashboard.module.css";
import { CheckIcon } from "./icons";

const MANAGE_HREF = "/manage-subscription";

type PlanItemKey = "tester" | "monthly" | "quarterly";

type PlanItem = {
  key: PlanItemKey;
  tierName: string;
  priceNumber: string;
  priceSuffix: string;
  featureKeys: ReadonlyArray<"f1" | "f2" | "f3" | "f4">;
  featured?: boolean;
};

const PLAN_ITEMS: readonly PlanItem[] = [
  {
    key: "tester",
    tierName: "tester_paid",
    priceNumber: formatRubles(SUBSCRIPTION_TIERS.tester_paid?.price.RUB ?? 5),
    priceSuffix: "₽ /день",
    featureKeys: ["f1", "f2", "f3", "f4"],
  },
  {
    key: "monthly",
    tierName: "basic_monthly",
    priceNumber: formatRubles(
      SUBSCRIPTION_TIERS.basic_monthly?.price.RUB ?? 1999
    ),
    priceSuffix: "₽ /мес",
    featureKeys: ["f1", "f2", "f3", "f4"],
    featured: true,
  },
  {
    key: "quarterly",
    tierName: "basic_quarterly",
    priceNumber: formatRubles(
      SUBSCRIPTION_TIERS.basic_quarterly?.price.RUB ?? 4999
    ),
    priceSuffix: "₽ /квартал",
    featureKeys: ["f1", "f2", "f3", "f4"],
  },
];

function formatRubles(amount: number): string {
  return amount.toLocaleString("ru-RU");
}

export function PlansGridCard() {
  const router = useRouter();
  const t = useTranslations("auth.subscription.dashboard.plans");

  return (
    <section
      aria-label={t("title")}
      className={`${styles.card} ${styles.cardSpan2}`}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
      }}
    >
      <div className={styles.plansSectionHead}>
        <h3 className={styles.plansSectionTitle}>{t("title")}</h3>
        <span className={styles.plansSectionHint}>{t("subtitle")}</span>
      </div>
      <div className={styles.planGrid}>
        {PLAN_ITEMS.map((item) => {
          const featuredCls = item.featured
            ? ` ${styles.planCardFeatured}`
            : "";
          return (
            <article
              className={`${styles.planCard}${featuredCls}`}
              key={item.key}
            >
              {item.featured && (
                <span className={styles.planCardRibbon}>{t("ribbon")}</span>
              )}
              <h4 className={styles.planCardName}>
                {t(`items.${item.key}.name`)}
              </h4>
              <div className={styles.planCardPrice}>
                <span className={styles.planCardPriceNum}>
                  {item.priceNumber}
                </span>
                <span className={styles.planCardPricePer}>
                  {item.priceSuffix}
                </span>
              </div>
              <ul className={styles.planCardList}>
                {item.featureKeys.map((fk) => (
                  <li className={styles.planCardItem} key={fk}>
                    <CheckIcon />
                    <span>{t(`items.${item.key}.${fk}`)}</span>
                  </li>
                ))}
              </ul>
              <button
                className={`${styles.btn} ${
                  item.featured ? styles.btnPrimary : styles.btnOutline
                }`}
                onClick={() => router.push(MANAGE_HREF)}
                type="button"
              >
                {t("subscribe")}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
