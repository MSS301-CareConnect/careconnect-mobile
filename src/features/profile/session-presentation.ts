import { formatInstant } from '../../core/time';

const browsers: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\//i, 'Edge'],
  [/OPR\//i, 'Opera'],
  [/SamsungBrowser\//i, 'Samsung Internet'],
  [/CocCoc|coc_coc_browser/i, 'Cốc Cốc'],
  [/Firefox\/|FxiOS\//i, 'Firefox'],
  [/Chrome\/|CriOS\//i, 'Chrome'],
  [/Version\/.*Safari/i, 'Safari'],
];

export function sessionDevice(userAgent: string) {
  const browser = browsers.find(([pattern]) => pattern.test(userAgent))?.[1];
  let os: string | undefined;
  if (/Windows NT 10/i.test(userAgent)) os = 'Windows 10/11';
  else if (/Windows/i.test(userAgent)) os = 'Windows';
  else if (/iPad/i.test(userAgent)) os = 'iPadOS';
  else if (/iPhone|iPod/i.test(userAgent)) os = 'iOS';
  else if (/Android/i.test(userAgent)) os = 'Android';
  else if (/Mac OS X/i.test(userAgent)) os = 'macOS';
  else if (/CrOS/i.test(userAgent)) os = 'ChromeOS';
  else if (/Linux/i.test(userAgent)) os = 'Linux';
  return {
    name: [browser, os].filter(Boolean).join(' · '),
    mobile: /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent),
  };
}

export function sessionActivity(
  value: string,
  locale: string,
  now: number,
  t: (key: string) => string,
) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return undefined;
  const seconds = Math.floor((now - timestamp) / 1000);
  if (seconds < 0 || seconds >= 30 * 86400) return formatInstant(value, locale);
  // RelativeTimeFormat is absent in the app's Android runtime; use the app's bilingual copy.
  if (seconds < 60) return t('sessionsJustNow');
  if (seconds < 3600) {
    const count = Math.floor(seconds / 60);
    return t(count === 1 ? 'sessionsMinuteAgo' : 'sessionsMinutesAgo').replace(
      '{count}',
      String(count),
    );
  }
  if (seconds < 86400) {
    const count = Math.floor(seconds / 3600);
    return t(count === 1 ? 'sessionsHourAgo' : 'sessionsHoursAgo').replace(
      '{count}',
      String(count),
    );
  }
  const count = Math.floor(seconds / 86400);
  if (count === 1) return t('sessionsYesterday');
  if (count === 2) return t('sessionsDayBeforeYesterday');
  return t('sessionsDaysAgo').replace('{count}', String(count));
}
