/**
 * Format `date` relative to `now` (a `Date.now()` timestamp) using
 * `Intl.RelativeTimeFormat` — e.g. "3 minutes ago", "in 2 hours".
 *
 * Shared by both `DraftBanner` and the headless `useDraftBanner` so the two
 * surfaces phrase time identically.
 */
export function relativeTime(date: Date, now: number, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const diffMs = date.getTime() - now;
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffMs / 60_000);
  const diffHr = Math.round(diffMs / 3_600_000);
  const diffDay = Math.round(diffMs / 86_400_000);

  if (Math.abs(diffMin) < 1) return rtf.format(diffSec, 'second');
  if (Math.abs(diffHr) < 1) return rtf.format(diffMin, 'minute');
  if (Math.abs(diffDay) < 1) return rtf.format(diffHr, 'hour');
  return rtf.format(diffDay, 'day');
}
