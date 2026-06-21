import { useCallback, useEffect, useState } from 'react';
import { relativeTime } from './relativeTime';

export interface UseDraftBannerOptions {
  /** When the restored draft was last saved. Drives the relative-time label and triggers re-show on change. */
  savedAt: Date | null;
  /**
   * ms before `visible` flips to false on its own. Default 10000 (matches
   * {@link DraftBanner} and follows WAI-ARIA live-region guidance — shorter
   * is risky for screen reader users). 0 disables auto-hide.
   */
  autoHideMs?: number;
  /** Locale for `Intl.RelativeTimeFormat`. Default 'en'. */
  locale?: string;
}

export interface UseDraftBannerReturn {
  /** True while the banner should render. Becomes false on dismiss or after autoHideMs. */
  visible: boolean;
  /** Imperatively hide the banner. */
  dismiss: () => void;
  /** Human-readable relative time, e.g. "3 hours ago" or null if savedAt is null. */
  relativeTime: string | null;
}

/**
 * Headless banner state. Wire it to your own UI when the bundled {@link DraftBanner} doesn't fit.
 *
 * @example
 * const draft = useFormDraft(...);
 * const banner = useDraftBanner({ savedAt: draft.savedAt });
 * return banner.visible ? (
 *   <MyBanner>{banner.relativeTime}<button onClick={banner.dismiss}>×</button></MyBanner>
 * ) : null;
 */
export function useDraftBanner(options: UseDraftBannerOptions): UseDraftBannerReturn {
  const { savedAt, autoHideMs = 10_000, locale = 'en' } = options;
  const [visible, setVisible] = useState(Boolean(savedAt));

  // Gate Date.now()-derived output behind a post-mount flag to avoid SSR/client
  // hydration mismatch. On the server `relativeTime` is null; the first client
  // render also returns null (matching the server); the second render (after
  // mount) computes the real value.
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    setVisible(Boolean(savedAt));
  }, [savedAt]);

  useEffect(() => {
    if (!visible || !autoHideMs) return;
    const t = setTimeout(() => setVisible(false), autoHideMs);
    return () => clearTimeout(t);
  }, [visible, autoHideMs]);

  const dismiss = useCallback(() => setVisible(false), []);

  const label = isClient && savedAt ? relativeTime(savedAt, Date.now(), locale) : null;

  return { visible, dismiss, relativeTime: label };
}
