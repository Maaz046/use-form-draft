import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { useFormDraftRHF } from './rhf';

interface Shape {
  title: string;
  qty: number;
}

describe('useFormDraftRHF', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('persists form values after they change (debounced)', () => {
    const { result } = renderHook(() => {
      const form = useForm<Shape>({ defaultValues: { title: '', qty: 0 } });
      const draft = useFormDraftRHF(form, { key: 'rhf:test' });
      return { form, draft };
    });

    act(() => {
      result.current.form.setValue('title', 'tender X');
      result.current.form.setValue('qty', 25);
    });
    act(() => { vi.advanceTimersByTime(400); });

    const stored = JSON.parse(localStorage.getItem('rhf:test')!);
    expect(stored.state).toMatchObject({ title: 'tender X', qty: 25 });
  });

  it('hydrates form values from a stored draft via form.reset on mount', () => {
    localStorage.setItem('rhf:test', JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      hadFile: false,
      state: { title: 'restored title', qty: 99 },
    }));

    const { result } = renderHook(() => {
      const form = useForm<Shape>({ defaultValues: { title: '', qty: 0 } });
      const draft = useFormDraftRHF(form, { key: 'rhf:test' });
      return { form, draft };
    });

    expect(result.current.draft.restored).toBe(true);
    expect(result.current.form.getValues()).toEqual({ title: 'restored title', qty: 99 });
  });

  it('clear() empties storage and resets the restored flag', () => {
    localStorage.setItem('rhf:test', JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      hadFile: false,
      state: { title: 'x', qty: 1 },
    }));

    const { result } = renderHook(() => {
      const form = useForm<Shape>({ defaultValues: { title: '', qty: 0 } });
      const draft = useFormDraftRHF(form, { key: 'rhf:test' });
      return { form, draft };
    });

    expect(result.current.draft.restored).toBe(true);
    act(() => { result.current.draft.clear(); });

    expect(localStorage.getItem('rhf:test')).toBeNull();
    expect(result.current.draft.restored).toBe(false);
  });
});
