import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { DraftBanner } from './DraftBanner';

describe('DraftBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('returns null when savedAt is null', () => {
    const { container } = render(
      <DraftBanner savedAt={null} onDiscard={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the restored message and discard control when savedAt is set', () => {
    render(
      <DraftBanner
        savedAt={new Date(Date.now() - 3 * 60_000)}
        onDiscard={() => {}}
        autoHideMs={0}
      />,
    );
    expect(screen.getByText(/Draft restored/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Discard/i })).toBeTruthy();
  });

  it('renders re-attach hint when hadFile is true', () => {
    render(
      <DraftBanner
        savedAt={new Date()}
        hadFile
        onDiscard={() => {}}
        autoHideMs={0}
      />,
    );
    expect(screen.getByText(/re-attach file/)).toBeTruthy();
  });

  it('auto-hides after autoHideMs', () => {
    const { container } = render(
      <DraftBanner
        savedAt={new Date()}
        onDiscard={() => {}}
        autoHideMs={2000}
      />,
    );
    expect(container.firstChild).not.toBeNull();
    act(() => { vi.advanceTimersByTime(2000); });
    expect(container.firstChild).toBeNull();
  });

  it('calls onDiscard and hides when Discard is clicked', () => {
    const onDiscard = vi.fn();
    const { container } = render(
      <DraftBanner
        savedAt={new Date()}
        onDiscard={onDiscard}
        autoHideMs={0}
      />,
    );
    act(() => {
      screen.getByRole('button', { name: /Discard/i }).click();
    });
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(container.firstChild).toBeNull();
  });

  it('honors custom messages', () => {
    render(
      <DraftBanner
        savedAt={new Date()}
        onDiscard={() => {}}
        autoHideMs={0}
        messages={{ restored: 'Brouillon restauré', discard: 'Supprimer' }}
      />,
    );
    expect(screen.getByText(/Brouillon restauré/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeTruthy();
  });

  it('formats relative time in the supplied locale', () => {
    // 2 minutes ago, French
    const twoMinAgo = new Date(Date.now() - 2 * 60_000);
    render(
      <DraftBanner
        savedAt={twoMinAgo}
        onDiscard={() => {}}
        autoHideMs={0}
        locale="fr"
        messages={{ restored: 'Brouillon restauré' }}
      />,
    );
    // French Intl.RelativeTimeFormat outputs "il y a 2 minutes" (or "il y a 2 min.")
    expect(screen.getByText(/il y a/)).toBeTruthy();
  });

  it('re-shows when savedAt changes after a dismiss (parity with useDraftBanner)', () => {
    const savedAtA = new Date();
    const { container, rerender } = render(
      <DraftBanner savedAt={savedAtA} onDiscard={() => {}} autoHideMs={0} />,
    );
    expect(container.firstChild).not.toBeNull();
    act(() => {
      screen.getByRole('button', { name: /Dismiss/i }).click();
    });
    expect(container.firstChild).toBeNull();

    // A fresh savedAt (e.g. user types more, a new draft is restored) re-shows the banner.
    const savedAtB = new Date(savedAtA.getTime() + 1);
    rerender(<DraftBanner savedAt={savedAtB} onDiscard={() => {}} autoHideMs={0} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('escDismiss=true: Escape key hides the banner', () => {
    const { container } = render(
      <DraftBanner
        savedAt={new Date()}
        onDiscard={() => {}}
        autoHideMs={0}
        escDismiss
      />,
    );
    expect(container.firstChild).not.toBeNull();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(container.firstChild).toBeNull();
  });

  it('escDismiss=false (default): Escape key is a no-op', () => {
    const { container } = render(
      <DraftBanner
        savedAt={new Date()}
        onDiscard={() => {}}
        autoHideMs={0}
      />,
    );
    expect(container.firstChild).not.toBeNull();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(container.firstChild).not.toBeNull();
  });

  it('escDismiss removes the document keydown listener on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(
      <DraftBanner
        savedAt={new Date()}
        onDiscard={() => {}}
        autoHideMs={0}
        escDismiss
      />,
    );
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
