const RU_DATE_SAME_MONTH = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
});

const RU_DATE_FULL = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const RU_DATE_DAY_MONTH = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
});

const MS_PER_HOUR = 1000 * 60 * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;

const RU_TIME_HM = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const HOUR_FORMS: RuPluralForms = ["час", "часа", "часов"];
const DAY_FORMS: RuPluralForms = ["день", "дня", "дней"];

export function formatBillingCycle(start: Date, end: Date): string {
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  if (sameMonth) {
    const startDay = RU_DATE_SAME_MONTH.format(start);
    const endFull = RU_DATE_FULL.format(end);
    return `${startDay} — ${endFull}`;
  }

  if (sameYear) {
    const startDayMonth = RU_DATE_DAY_MONTH.format(start);
    const endFull = RU_DATE_FULL.format(end);
    return `${startDayMonth} — ${endFull}`;
  }

  return `${RU_DATE_FULL.format(start)} — ${RU_DATE_FULL.format(end)}`;
}

export function formatRuDate(date: Date): string {
  return RU_DATE_FULL.format(date);
}

export function formatRuDayMonth(date: Date): string {
  return RU_DATE_DAY_MONTH.format(date);
}

const RU_DATE_DAY_MONTH_SHORT = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
});

/** Compact uppercase day + month for tags, e.g. "1 ИЮН". */
export function formatRuDayMonthShort(date: Date): string {
  return RU_DATE_DAY_MONTH_SHORT.format(date).replace(".", "").toUpperCase();
}

const RU_MONTH_STANDALONE = new Intl.DateTimeFormat("ru-RU", {
  month: "long",
});

/** Standalone lowercase month name, e.g. "май". */
export function formatRuMonth(date: Date): string {
  return RU_MONTH_STANDALONE.format(date);
}

export type RuPluralForms = readonly [string, string, string];

export function pluralRu(n: number, forms: RuPluralForms): string {
  const absN = Math.abs(n);
  const mod10 = absN % 10;
  const mod100 = absN % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return forms[0];
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return forms[1];
  }
  return forms[2];
}

export function daysUntil(target: Date, from: Date = new Date()): number {
  const diffMs = target.getTime() - from.getTime();
  return Math.max(0, Math.ceil(diffMs / MS_PER_DAY));
}

export function formatRelativeRu(
  target: Date,
  from: Date = new Date()
): string {
  const diffMs = target.getTime() - from.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return "скоро";
  }
  if (diffMs < MS_PER_HOUR) {
    return "менее чем через час";
  }
  if (diffMs < MS_PER_DAY) {
    const hours = Math.round(diffMs / MS_PER_HOUR);
    return `через ${hours} ${pluralRu(hours, HOUR_FORMS)}`;
  }
  const days = Math.ceil(diffMs / MS_PER_DAY);
  return `через ${days} ${pluralRu(days, DAY_FORMS)}`;
}

export function formatRuDayTime(date: Date, now: Date = new Date()): string {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTarget = new Date(date);
  startOfTarget.setHours(0, 0, 0, 0);
  const dayDiff = Math.round(
    (startOfTarget.getTime() - startOfToday.getTime()) / MS_PER_DAY
  );

  if (dayDiff === 0) {
    return `сегодня · ${RU_TIME_HM.format(date)}`;
  }
  if (dayDiff === 1) {
    return `завтра · ${RU_TIME_HM.format(date)}`;
  }
  if (dayDiff > 1 && dayDiff <= 7) {
    return `через ${dayDiff} ${pluralRu(dayDiff, DAY_FORMS)}`;
  }
  return formatRuDate(date);
}
