export function vietnamDay(now = new Date()): string {
  return new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
}
export function formatInstant(value: string, locale: string, options?: Intl.DateTimeFormatOptions) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(
        locale === 'vi' ? 'vi-VN' : 'en-GB',
        options ?? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' },
      ).format(date);
}
export function checkInAllowed(start: string, end: string, now = Date.now()) {
  const s = Date.parse(start),
    e = Date.parse(end);
  return now >= s - 30 * 60000 && now < s + 30 * 60000 && now < e;
}
