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
});
