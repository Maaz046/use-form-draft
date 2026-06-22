import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormDraft } from './useFormDraft';

describe('useFormDraft', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns restored: false and does not call hydrate when no draft exists', () => {
    const hydrate = vi.fn();
    const { result } = renderHook(() =>
      useFormDraft('test:key', { name: '' }, hydrate),
    );
    expect(result.current.restored).toBe(false);
    expect(result.current.savedAt).toBeNull();
    expect(hydrate).not.toHaveBeenCalled();
  });

  it('calls hydrate and returns restored: true when a valid draft exists', () => {
    const savedAt = new Date().toISOString();
    localStorage.setItem('test:key', JSON.stringify({
      version: 1, savedAt, hadFile: false, state: { name: 'hello' },
    }));
    const hydrate = vi.fn();
    const { result } = renderHook(() =>
      useFormDraft('test:key', { name: '' }, hydrate),
    );
    expect(result.current.restored).toBe(true);
    expect(hydrate).toHaveBeenCalledWith({ name: 'hello' });
    expect(result.current.savedAt).toBeInstanceOf(Date);
  });

  it('discards draft older than ttlDays and returns restored: false', () => {
    const old = new Date();
    old.setDate(old.getDate() - 31);
    localStorage.setItem('test:key', JSON.stringify({
      version: 1, savedAt: old.toISOString(), hadFile: false, state: { name: 'old' },
    }));
    const hydrate = vi.fn();
    const { result } = renderHook(() =>
      useFormDraft('test:key', { name: '' }, hydrate),
    );
    expect(result.current.restored).toBe(false);
    expect(hydrate).not.toHaveBeenCalled();
  });

  it('respects a custom ttlDays', () => {
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    localStorage.setItem('test:key', JSON.stringify({
      version: 1, savedAt: fourDaysAgo.toISOString(), hadFile: false, state: { name: 'older' },
    }));
    const hydrate = vi.fn();
    renderHook(() =>
      useFormDraft('test:key', { name: '' }, hydrate, { ttlDays: 3 }),
    );
    expect(hydrate).not.toHaveBeenCalled();
  });

  it('discards draft when the version option does not match the stored version', () => {
    localStorage.setItem('test:key', JSON.stringify({
      version: 1, savedAt: new Date().toISOString(), hadFile: false, state: { name: 'v1-shape' },
    }));
    const hydrate = vi.fn();
    const { result } = renderHook(() =>
      useFormDraft('test:key', { name: '' }, hydrate, { version: 2 }),
    );
    expect(result.current.restored).toBe(false);
    expect(hydrate).not.toHaveBeenCalled();
  });

  it('discards corrupted JSON silently and returns restored: false', () => {
    localStorage.setItem('test:key', 'not-valid-json{{{');
    const hydrate = vi.fn();
    const { result } = renderHook(() =>
      useFormDraft('test:key', { name: '' }, hydrate),
    );
    expect(result.current.restored).toBe(false);
    expect(hydrate).not.toHaveBeenCalled();
  });

  it('writes to localStorage after 400ms debounce when state changes', () => {
    const hydrate = vi.fn();
    const { rerender } = renderHook(
      ({ state }: { state: { name: string } }) =>
        useFormDraft('test:key', state, hydrate),
      { initialProps: { state: { name: 'initial' } } },
    );

    act(() => { vi.advanceTimersByTime(400); });
    expect(localStorage.getItem('test:key')).toBeNull();

    rerender({ state: { name: 'changed' } });
    expect(localStorage.getItem('test:key')).toBeNull();

    act(() => { vi.advanceTimersByTime(400); });
    const stored = JSON.parse(localStorage.getItem('test:key')!);
    expect(stored.state).toEqual({ name: 'changed' });
    expect(stored.version).toBe(1);
    expect(stored.hadFile).toBe(false);
  });

  it('respects a custom debounceMs', () => {
    const hydrate = vi.fn();
    const { rerender } = renderHook(
      ({ state }: { state: { name: string } }) =>
        useFormDraft('test:key', state, hydrate, { debounceMs: 100 }),
      { initialProps: { state: { name: 'initial' } } },
    );
    rerender({ state: { name: 'changed' } });
    act(() => { vi.advanceTimersByTime(99); });
    expect(localStorage.getItem('test:key')).toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    expect(localStorage.getItem('test:key')).not.toBeNull();
  });

  it('does not write to localStorage when disabled: true', () => {
    const hydrate = vi.fn();
    const { rerender } = renderHook(
      ({ state }: { state: { name: string } }) =>
        useFormDraft('test:key', state, hydrate, { disabled: true }),
      { initialProps: { state: { name: 'initial' } } },
    );
    rerender({ state: { name: 'changed' } });
    act(() => { vi.advanceTimersByTime(400); });
    expect(localStorage.getItem('test:key')).toBeNull();
  });

  it('strips excluded keys before persisting', () => {
    const hydrate = vi.fn();
    const { rerender } = renderHook(
      ({ state }: { state: { name: string; password: string } }) =>
        useFormDraft('test:key', state, hydrate, { exclude: ['password'] }),
      { initialProps: { state: { name: 'jane', password: 'initial' } } },
    );
    // Change a non-excluded field so a write actually fires.
    rerender({ state: { name: 'jane updated', password: 'secret' } });
    act(() => { vi.advanceTimersByTime(400); });
    const stored = JSON.parse(localStorage.getItem('test:key')!);
    expect(stored.state).toEqual({ name: 'jane updated' });
    expect(stored.state.password).toBeUndefined();
  });

  it('does not write when only excluded fields change', () => {
    const hydrate = vi.fn();
    const { rerender } = renderHook(
      ({ state }: { state: { name: string; password: string } }) =>
        useFormDraft('test:key', state, hydrate, { exclude: ['password'] }),
      { initialProps: { state: { name: 'jane', password: 'initial' } } },
    );
    rerender({ state: { name: 'jane', password: 'updated-secret' } });
    act(() => { vi.advanceTimersByTime(400); });
    expect(localStorage.getItem('test:key')).toBeNull();
  });

  it('persists hasFile flag when option is true', () => {
    const hydrate = vi.fn();
    const { rerender } = renderHook(
      ({ state }: { state: { title: string } }) =>
        useFormDraft('test:key', state, hydrate, { hasFile: true }),
      { initialProps: { state: { title: 'init' } } },
    );
    rerender({ state: { title: 'changed' } });
    act(() => { vi.advanceTimersByTime(400); });
    const stored = JSON.parse(localStorage.getItem('test:key')!);
    expect(stored.hadFile).toBe(true);
  });

  it('clear() removes the key from localStorage and resets restored to false', () => {
    localStorage.setItem('test:key', JSON.stringify({
      version: 1, savedAt: new Date().toISOString(), hadFile: false, state: { name: 'hello' },
    }));
    const hydrate = vi.fn();
    const { result } = renderHook(() =>
      useFormDraft('test:key', { name: '' }, hydrate),
    );
    expect(result.current.restored).toBe(true);

    act(() => { result.current.clear(); });

    expect(localStorage.getItem('test:key')).toBeNull();
    expect(result.current.restored).toBe(false);
    expect(result.current.savedAt).toBeNull();
  });

  it('discards stored draft if hydrate throws and does not rethrow', () => {
    localStorage.setItem('test:key', JSON.stringify({
      version: 1, savedAt: new Date().toISOString(), hadFile: false, state: { name: 'bad' },
    }));
    const hydrate = vi.fn(() => { throw new Error('shape mismatch'); });
    expect(() => {
      renderHook(() => useFormDraft('test:key', { name: '' }, hydrate));
    }).not.toThrow();
    expect(localStorage.getItem('test:key')).toBeNull();
  });

  it('persists drafts under separate keys independently', () => {
    const hydrateA = vi.fn();
    const hydrateB = vi.fn();
    const { rerender: rerenderA } = renderHook(
      ({ state }: { state: { x: number } }) =>
        useFormDraft('test:A', state, hydrateA),
      { initialProps: { state: { x: 0 } } },
    );
    const { rerender: rerenderB } = renderHook(
      ({ state }: { state: { y: number } }) =>
        useFormDraft('test:B', state, hydrateB),
      { initialProps: { state: { y: 0 } } },
    );

    rerenderA({ state: { x: 1 } });
    rerenderB({ state: { y: 9 } });
    act(() => { vi.advanceTimersByTime(400); });

    const a = JSON.parse(localStorage.getItem('test:A')!);
    const b = JSON.parse(localStorage.getItem('test:B')!);
    expect(a.state).toEqual({ x: 1 });
    expect(b.state).toEqual({ y: 9 });
  });

  it('does not write the initial state under React 18 StrictMode (double-mount)', () => {
    const hydrate = vi.fn();
    renderHook(
      () => useFormDraft('test:strict', { name: 'initial', count: 0 }, hydrate),
      { wrapper: StrictMode },
    );
    act(() => { vi.advanceTimersByTime(800); });
    expect(localStorage.getItem('test:strict')).toBeNull();
  });

  it('does not write when re-rendered with a new object reference but identical content', () => {
    // Mimics react-hook-form's form.watch() returning a fresh snapshot every render.
    const hydrate = vi.fn();
    const { rerender } = renderHook(
      ({ state }: { state: { name: string } }) =>
        useFormDraft('test:no-op', state, hydrate),
      { initialProps: { state: { name: 'jane' } } },
    );
    rerender({ state: { name: 'jane' } });
    rerender({ state: { name: 'jane' } });
    rerender({ state: { name: 'jane' } });
    act(() => { vi.advanceTimersByTime(800); });
    expect(localStorage.getItem('test:no-op')).toBeNull();
  });

  it('still writes on real state changes after StrictMode mount', () => {
    const hydrate = vi.fn();
    const { rerender } = renderHook(
      ({ state }: { state: { name: string } }) =>
        useFormDraft('test:strict-change', state, hydrate),
      { initialProps: { state: { name: 'initial' } }, wrapper: StrictMode },
    );
    rerender({ state: { name: 'edited' } });
    act(() => { vi.advanceTimersByTime(400); });
    const stored = JSON.parse(localStorage.getItem('test:strict-change')!);
    expect(stored.state).toEqual({ name: 'edited' });
  });

  it('storage stays empty after clear() + setState(empty) — the canonical submit flow', () => {
    // Round-2 regression: pre-fix, clear() cleared storage but left lastWrittenJsonRef
    // holding the pre-clear payload. The next setState(empty) then differed from that
    // stale ref and re-persisted the empty state, silently undoing the submit cleanup.
    const hydrate = vi.fn();
    const { result, rerender } = renderHook(
      ({ state, disabled }: { state: { name: string }; disabled: boolean }) =>
        useFormDraft('clear:race', state, hydrate, { disabled }),
      { initialProps: { state: { name: 'typed' }, disabled: false } },
    );
    rerender({ state: { name: 'typed more' }, disabled: false });
    act(() => { vi.advanceTimersByTime(400); });
    expect(localStorage.getItem('clear:race')).not.toBeNull();

    rerender({ state: { name: 'typed more' }, disabled: true });
    act(() => { result.current.clear(); });
    rerender({ state: { name: '' }, disabled: false });
    act(() => { vi.advanceTimersByTime(800); });

    expect(localStorage.getItem('clear:race')).toBeNull();
  });

  it('hydrates a draft exactly at the TTL boundary (code uses `>`, equal is not expired)', () => {
    // ageMs > ttlDays * 86_400_000 is the discard condition.
    // ageMs === ttlDays * 86_400_000 → NOT expired.
    const exactlyOneDayAgo = new Date(Date.now() - 86_400_000);
    localStorage.setItem('test:ttl', JSON.stringify({
      version: 1,
      savedAt: exactlyOneDayAgo.toISOString(),
      hadFile: false,
      state: { name: 'edge' },
    }));
    const hydrate = vi.fn();
    renderHook(() =>
      useFormDraft('test:ttl', { name: '' }, hydrate, { ttlDays: 1 }),
    );
    expect(hydrate).toHaveBeenCalledWith({ name: 'edge' });
  });

  it('discards a draft 1ms past the TTL boundary', () => {
    const justPast = new Date(Date.now() - 86_400_001);
    localStorage.setItem('test:ttl', JSON.stringify({
      version: 1,
      savedAt: justPast.toISOString(),
      hadFile: false,
      state: { name: 'expired' },
    }));
    const hydrate = vi.fn();
    renderHook(() =>
      useFormDraft('test:ttl', { name: '' }, hydrate, { ttlDays: 1 }),
    );
    expect(hydrate).not.toHaveBeenCalled();
  });

  it('two components on the same key — last write wins (documented v0.1 semantics)', () => {
    const hydrateA = vi.fn();
    const hydrateB = vi.fn();
    const { rerender: rerenderA } = renderHook(
      ({ state }: { state: { x: string } }) => useFormDraft('same:key', state, hydrateA),
      { initialProps: { state: { x: 'a-initial' } } },
    );
    const { rerender: rerenderB } = renderHook(
      ({ state }: { state: { x: string } }) => useFormDraft('same:key', state, hydrateB),
      { initialProps: { state: { x: 'b-initial' } } },
    );
    rerenderA({ state: { x: 'a-changed' } });
    act(() => { vi.advanceTimersByTime(400); });
    rerenderB({ state: { x: 'b-changed' } });
    act(() => { vi.advanceTimersByTime(400); });
    const stored = JSON.parse(localStorage.getItem('same:key')!);
    expect(stored.state).toEqual({ x: 'b-changed' });
  });

  it('cancels a pending write when disabled flips to true mid-debounce', () => {
    const hydrate = vi.fn();
    const { rerender } = renderHook(
      ({ state, disabled }: { state: { name: string }; disabled: boolean }) =>
        useFormDraft('test:flip', state, hydrate, { disabled }),
      { initialProps: { state: { name: 'init' }, disabled: false } },
    );
    rerender({ state: { name: 'changed' }, disabled: false });
    act(() => { vi.advanceTimersByTime(200); });
    rerender({ state: { name: 'changed' }, disabled: true });
    act(() => { vi.advanceTimersByTime(800); });
    expect(localStorage.getItem('test:flip')).toBeNull();
  });

  it('resumes the write when disabled flips back to false with the form still dirty', () => {
    const hydrate = vi.fn();
    const { rerender } = renderHook(
      ({ state, disabled }: { state: { name: string }; disabled: boolean }) =>
        useFormDraft('test:flip-back', state, hydrate, { disabled }),
      { initialProps: { state: { name: 'init' }, disabled: false } },
    );
    rerender({ state: { name: 'changed' }, disabled: true });
    act(() => { vi.advanceTimersByTime(800); });
    expect(localStorage.getItem('test:flip-back')).toBeNull();
    rerender({ state: { name: 'changed' }, disabled: false });
    act(() => { vi.advanceTimersByTime(400); });
    const stored = JSON.parse(localStorage.getItem('test:flip-back')!);
    expect(stored.state).toEqual({ name: 'changed' });
  });

  it('does not crash on non-serializable state (circular reference)', () => {
    interface Circ { name: string; self?: Circ }
    const circular: Circ = { name: 'x' };
    circular.self = circular;
    const hydrate = vi.fn();

    expect(() => {
      const { rerender } = renderHook(
        ({ state }: { state: Circ }) =>
          useFormDraft('circ', state, hydrate),
        { initialProps: { state: circular } },
      );
      rerender({ state: circular });
      act(() => { vi.advanceTimersByTime(400); });
    }).not.toThrow();
    // Storage stays empty because stringify failed silently
    expect(localStorage.getItem('circ')).toBeNull();
  });

  it('does not throw when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const hydrate = vi.fn();
    expect(() => {
      const { result } = renderHook(() =>
        useFormDraft('test:key', { name: '' }, hydrate),
      );
      act(() => { result.current.clear(); });
    }).not.toThrow();
  });

  it('does not throw when accessing window.localStorage itself throws (sandboxed iframe / disabled by policy)', () => {
    // A sandboxed iframe or a "block site data" policy throws SecurityError on the
    // property getter, before any method runs. typeof does not suppress it.
    const spy = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('SecurityError: access denied');
    });
    const hydrate = vi.fn();
    expect(() => {
      const { result, rerender } = renderHook(
        ({ state }: { state: { name: string } }) =>
          useFormDraft('iframe:key', state, hydrate),
        { initialProps: { state: { name: 'a' } } },
      );
      rerender({ state: { name: 'b' } });
      act(() => { vi.advanceTimersByTime(400); });
      act(() => { result.current.clear(); });
    }).not.toThrow();
    expect(hydrate).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  // ---- storage adapter ----

  it('persists to a custom storage adapter instead of localStorage', () => {
    const store = new Map<string, string>();
    const adapter = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    };
    const hydrate = vi.fn();
    const { rerender } = renderHook(
      ({ state }: { state: { n: string } }) =>
        useFormDraft('adapter:key', state, hydrate, { storage: adapter }),
      { initialProps: { state: { n: 'a' } } },
    );
    rerender({ state: { n: 'b' } });
    act(() => { vi.advanceTimersByTime(400); });
    expect(localStorage.getItem('adapter:key')).toBeNull();
    expect(JSON.parse(store.get('adapter:key')!).state).toEqual({ n: 'b' });
  });

  it('restores from a sessionStorage adapter', () => {
    sessionStorage.setItem('sess:key', JSON.stringify({
      version: 1, savedAt: new Date().toISOString(), hadFile: false, state: { n: 'from-session' },
    }));
    const hydrate = vi.fn();
    renderHook(() =>
      useFormDraft('sess:key', { n: '' }, hydrate, { storage: sessionStorage }),
    );
    expect(hydrate).toHaveBeenCalledWith({ n: 'from-session' });
    sessionStorage.clear();
  });

  // ---- cross-tab sync ----

  it('crossTab: hydrates when another tab saves the same key', () => {
    const hydrate = vi.fn();
    renderHook(() => useFormDraft('tab:key', { n: '' }, hydrate, { crossTab: true }));
    const payload = JSON.stringify({
      version: 1, savedAt: new Date().toISOString(), hadFile: false, state: { n: 'other-tab' },
    });
    act(() => {
      localStorage.setItem('tab:key', payload);
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'tab:key', newValue: payload, storageArea: localStorage,
      }));
    });
    expect(hydrate).toHaveBeenCalledWith({ n: 'other-tab' });
  });

  it('does not react to storage events when crossTab is off (default)', () => {
    const hydrate = vi.fn();
    renderHook(() => useFormDraft('tab:off', { n: '' }, hydrate));
    const payload = JSON.stringify({
      version: 1, savedAt: new Date().toISOString(), hadFile: false, state: { n: 'other-tab' },
    });
    act(() => {
      localStorage.setItem('tab:off', payload);
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'tab:off', newValue: payload, storageArea: localStorage,
      }));
    });
    expect(hydrate).not.toHaveBeenCalled();
  });

  it('crossTab: ignores storage events for other keys', () => {
    const hydrate = vi.fn();
    renderHook(() => useFormDraft('tab:mine', { n: '' }, hydrate, { crossTab: true }));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'tab:other', newValue: 'whatever', storageArea: localStorage,
      }));
    });
    expect(hydrate).not.toHaveBeenCalled();
  });

  it('crossTab: drops the restored badge when another tab clears the draft', () => {
    localStorage.setItem('tab:clr', JSON.stringify({
      version: 1, savedAt: new Date().toISOString(), hadFile: false, state: { n: 'x' },
    }));
    const hydrate = vi.fn();
    const { result } = renderHook(() =>
      useFormDraft('tab:clr', { n: '' }, hydrate, { crossTab: true }),
    );
    expect(result.current.restored).toBe(true);
    act(() => {
      localStorage.removeItem('tab:clr');
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'tab:clr', newValue: null, storageArea: localStorage,
      }));
    });
    expect(result.current.restored).toBe(false);
    expect(result.current.savedAt).toBeNull();
  });

  it('removes the storage listener on unmount when crossTab is on', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const hydrate = vi.fn();
    const { unmount } = renderHook(() =>
      useFormDraft('tab:cleanup', { n: '' }, hydrate, { crossTab: true }),
    );
    unmount();
    expect(remove).toHaveBeenCalledWith('storage', expect.any(Function));
  });
});
