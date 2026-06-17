import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDraftBanner } from './useDraftBanner';

describe('useDraftBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts hidden when savedAt is null', () => {
    const { result } = renderHook(() => useDraftBanner({ savedAt: null }));
    expect(result.current.visible).toBe(false);
    expect(result.current.relativeTime).toBeNull();
  });

  it('flips visible from false → true when savedAt transitions from null to a Date', () => {
    const { result, rerender } = renderHook(
      ({ savedAt }: { savedAt: Date | null }) =>
        useDraftBanner({ savedAt, autoHideMs: 0 }),
      { initialProps: { savedAt: null } },
    );
    expect(result.current.visible).toBe(false);
    const newSavedAt = new Date();
    rerender({ savedAt: newSavedAt });
    expect(result.current.visible).toBe(true);
  });

  it('dismiss() flips visible to false and survives further savedAt changes within the same Date identity', () => {
    const savedAt = new Date();
    const { result } = renderHook(() => useDraftBanner({ savedAt, autoHideMs: 0 }));
    expect(result.current.visible).toBe(true);
    act(() => { result.current.dismiss(); });
    expect(result.current.visible).toBe(false);
  });

  it('auto-hides after autoHideMs', () => {
    const savedAt = new Date();
    const { result } = renderHook(() =>
      useDraftBanner({ savedAt, autoHideMs: 3_000 }),
    );
    expect(result.current.visible).toBe(true);
    act(() => { vi.advanceTimersByTime(3_000); });
    expect(result.current.visible).toBe(false);
  });

  it('default autoHideMs is 10_000', () => {
    const savedAt = new Date();
    const { result } = renderHook(() => useDraftBanner({ savedAt }));
    act(() => { vi.advanceTimersByTime(9_999); });
    expect(result.current.visible).toBe(true);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current.visible).toBe(false);
  });
});
