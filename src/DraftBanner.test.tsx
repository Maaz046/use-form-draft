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
});
