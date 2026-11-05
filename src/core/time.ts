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
// Q12: the check-in window comes from the center booking policy captured on the booking (checkInOpensAt /
// checkInClosesAt); 30 minutes either side is only the fallback for a response without it.
export function checkInAllowed(
  start: string,
  end: string,
  now = Date.now(),
  opensAt = '',
  closesAt = '',
) {
  const s = Date.parse(start),
    e = Date.parse(end);
  const opens = opensAt ? Date.parse(opensAt) : s - 30 * 60000;
  const closes = closesAt ? Date.parse(closesAt) : s + 30 * 60000;
  return now >= opens && now < closes && now < e;
}
