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

const MS_PER_DAY = 1000 * 60 * 60 * 24;

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
