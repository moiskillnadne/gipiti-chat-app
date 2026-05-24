import Link from "next/link";
import { formatCurrency } from "@/lib/billing/money";
import type { ChatSpendRow } from "@/lib/billing/spend";
import { getTranslations } from "@/lib/i18n/translate";
import { pluralRu, type RuPluralForms } from "@/lib/utils/format-billing";
import styles from "./dashboard.module.css";
import { ArrowRightIcon } from "./icons";

const MESSAGE_FORMS: RuPluralForms = ["сообщение", "сообщения", "сообщений"];
const SEARCH_FORMS: RuPluralForms = ["поиск", "поиска", "поисков"];
const IMAGE_FORMS: RuPluralForms = ["картинка", "картинки", "картинок"];

const DETAILS_HREF = "/subscription/usage";

function buildSubline(chat: ChatSpendRow): string {
  const parts: string[] = [];
  if (chat.model) {
    parts.push(chat.model);
  }
  parts.push(`${chat.messages} ${pluralRu(chat.messages, MESSAGE_FORMS)}`);
  if (chat.searches > 0) {
    parts.push(`${chat.searches} ${pluralRu(chat.searches, SEARCH_FORMS)}`);
  }
  if (chat.images > 0) {
    parts.push(`${chat.images} ${pluralRu(chat.images, IMAGE_FORMS)}`);
  }
  return parts.join(" · ");
}

export type TransactionHistoryCardProps = {
  chats: ChatSpendRow[];
  recentSpendMinor: number;
  currencyCode: string;
  minorUnits: number;
};

export async function TransactionHistoryCard({
  chats,
  recentSpendMinor,
  currencyCode,
  minorUnits,
}: TransactionHistoryCardProps) {
  const t = await getTranslations("auth.subscription.balance.history");

  return (
    <section
      aria-label={t("title")}
      className={`${styles.card} ${styles.cardTight}`}
    >
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{t("title")}</h3>
        <span className={styles.cardMeta}>{t("byChat")}</span>
      </div>

      {chats.length === 0 ? (
        <div className={styles.histEmpty}>{t("empty")}</div>
      ) : (
        <div className={styles.histList}>
          {chats.map((chat) => (
            <div className={styles.histRow} key={chat.chatId}>
              <div>
                <div className={styles.histTtl}>{chat.title}</div>
                <div className={styles.histSub}>{buildSubline(chat)}</div>
              </div>
              <div className={styles.histAmt}>
                {"−"}
                {formatCurrency(chat.totalMinor, currencyCode, minorUnits)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.histFoot}>
        <span className={styles.histFootSummary}>
          {t("last7days")}
          <b>
            {"−"}
            {formatCurrency(recentSpendMinor, currencyCode, minorUnits)}
          </b>
        </span>
        <Link className={styles.histFootLink} href={DETAILS_HREF}>
          {t("details")}
          <ArrowRightIcon />
        </Link>
      </div>
    </section>
  );
}
