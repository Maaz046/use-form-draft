import { type CSSProperties, type ReactNode, useEffect, useState } from 'react';
import { relativeTime } from './relativeTime';

export interface DraftBannerProps {
  /** From `useFormDraft().savedAt`. The banner does not render while this is null. */
  savedAt: Date | null;
  /** From `useFormDraft().hadFile`. When true, appends a hint that the file needs re-attaching. */
  hadFile?: boolean;
  /** Called when the user clicks Discard. Wire to `useFormDraft().clear`. */
  onDiscard: () => void;
  /**
   * ms before the banner auto-hides. Default 10000 (per WAI-ARIA live-region guidance —
   * shorter is risky for screen-reader users). Set to 0 to disable auto-hide.
   */
  autoHideMs?: number;
  /** Locale for `Intl.RelativeTimeFormat`. Default 'en'. Pairs with `messages` for full i18n. */
  locale?: string;
  /**
   * Listen for the Escape key on `document` and dismiss the banner. Default false.
   *
   * This is a **global** listener — if your app uses modals/dialogs that handle Escape
   * themselves, leave this off to avoid the banner getting dismissed alongside the modal.
   */
  escDismiss?: boolean;
  /** Override the close icon. Default is a unicode × character. */
  closeIcon?: ReactNode;
  /** Override i18n strings. */
  messages?: {
    /** Prefix before the relative time. Default: "Draft restored". */
    restored?: string;
    /** Hint shown when hadFile is true. Default: "re-attach file". */
    reattach?: string;
    /** Discard button label. Default: "Discard". */
    discard?: string;
    /** Close button aria-label. Default: "Dismiss". */
    dismiss?: string;
  };
  /** className applied to the outer container so consumers can override styling. */
  className?: string;
  /** Inline style overrides merged onto the outer container. */
  style?: CSSProperties;
}

const DEFAULT_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 8px 4px 10px',
  background: 'var(--ufd-banner-bg, #fffbeb)',
  borderLeft: '2px solid var(--ufd-banner-border, #f59e0b)',
  borderRadius: '0 4px 4px 0',
  marginBottom: 10,
  fontSize: 12,
  lineHeight: 1.3,
  color: 'var(--ufd-banner-text, #374151)',
};

const BUTTON_STYLE: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--ufd-banner-muted, #9ca3af)',
  fontSize: 11,
  padding: '0 4px',
  whiteSpace: 'nowrap',
};

const ICON_BUTTON_STYLE: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--ufd-banner-muted, #9ca3af)',
  padding: 2,
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: 14,
  lineHeight: 1,
};

const MUTED_STYLE: CSSProperties = {
  color: 'var(--ufd-banner-muted, #9ca3af)',
};

export function DraftBanner({
  savedAt,
  hadFile = false,
  onDiscard,
  autoHideMs = 10_000,
  escDismiss = false,
  locale = 'en',
  closeIcon,
  messages,
  className,
  style,
}: DraftBannerProps) {
  const [visible, setVisible] = useState(true);

  // Gate render behind a client-side flag so SSR output matches the first client render.
  // We can't compute relativeTime() without Date.now(), which would otherwise hydrate-mismatch.
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Re-show on savedAt transition — parity with useDraftBanner, so a fresh
  // restore after a previous dismiss / auto-hide brings the banner back.
  useEffect(() => {
    setVisible(true);
  }, [savedAt]);

  useEffect(() => {
    if (!autoHideMs) return;
    const t = setTimeout(() => setVisible(false), autoHideMs);
    return () => clearTimeout(t);
  }, [autoHideMs, savedAt]);

  useEffect(() => {
    if (!escDismiss || !visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [escDismiss, visible]);

  if (!isClient || !savedAt || !visible) return null;

  const restored = messages?.restored ?? 'Draft restored';
  const reattach = messages?.reattach ?? 're-attach file';
  const discard = messages?.discard ?? 'Discard';
  const dismiss = messages?.dismiss ?? 'Dismiss';

  return (
    <div
      role="status"
      className={className}
      style={{ ...DEFAULT_STYLE, ...style }}
    >
      <span style={{ flex: 1 }}>
        {restored} {relativeTime(savedAt, Date.now(), locale)}
        {hadFile && (
          <span style={MUTED_STYLE}>
            <span aria-hidden="true"> · </span>
            {reattach}
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={() => {
          onDiscard();
          setVisible(false);
        }}
        style={BUTTON_STYLE}
      >
        {discard}
      </button>
      <button
        type="button"
        aria-label={dismiss}
        onClick={() => setVisible(false)}
        style={ICON_BUTTON_STYLE}
      >
        <span aria-hidden="true">{closeIcon ?? '×'}</span>
      </button>
    </div>
  );
}
