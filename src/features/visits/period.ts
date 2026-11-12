import { addDays, isCalendarDay, mondayOf } from '../../core/time';

export const visitPeriodOptions = [
  { value: 'week', label: 'visitPeriodWeek' },
  { value: 'month', label: 'visitPeriodMonth' },
  { value: 'custom', label: 'visitPeriodCustom' },
] as const;
export type VisitPeriod = (typeof visitPeriodOptions)[number]['value'];
export type VisitDateFields = { from: string; to: string };

export function displayVisitDate(day: string) {
  return day.split('-').reverse().join('/');
}

export function visitDateInput(value: string) {
  const cleaned = value.trim();
  const day = /^\d{2}\/\d{2}\/\d{4}$/.test(cleaned)
    ? cleaned.split('/').reverse().join('-')
    : cleaned;
  return isCalendarDay(day) ? day : undefined;
}

export function visitPeriodBounds(
  period: VisitPeriod | undefined,
  today: string,
  custom: VisitDateFields,
) {
  if (period === 'custom') {
    const from = visitDateInput(custom.from);
    const to = visitDateInput(custom.to);
    if (!from || !to) return { error: 'visitPeriodInvalid' } as const;
    if (from > to) return { error: 'visitPeriodReversed' } as const;
    return { from, to };
  }
  if (period === 'week') {
    const from = mondayOf(today);
    return { from, to: addDays(from, 6) };
  }
  if (period === 'month') {
    const from = today.slice(0, 7) + '-01';
    const next = new Date(from + 'T00:00:00Z');
    next.setUTCMonth(next.getUTCMonth() + 1);
    return { from, to: addDays(next.toISOString().slice(0, 10), -1) };
  }
  return {};
}
