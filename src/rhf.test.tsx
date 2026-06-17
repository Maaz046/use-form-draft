import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFieldArray, useForm } from 'react-hook-form';
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

  it('persists and restores useFieldArray state across remounts (append / remove / move)', () => {
    interface ItemsShape {
      items: { v: number }[];
    }

    const r1 = renderHook(() => {
      const form = useForm<ItemsShape>({ defaultValues: { items: [] } });
      const fa = useFieldArray({ control: form.control, name: 'items' });
      const draft = useFormDraftRHF(form, { key: 'rhf:fa' });
      return { form, fa, draft };
    });

    // Append three
    act(() => {
      r1.result.current.fa.append({ v: 1 });
      r1.result.current.fa.append({ v: 2 });
      r1.result.current.fa.append({ v: 3 });
      r1.result.current.fa.append({ v: 4 });
    });
    act(() => { vi.advanceTimersByTime(400); });
    // Remove the second (index 1) — array should shrink
    act(() => {
      r1.result.current.fa.remove(1);
    });
    act(() => { vi.advanceTimersByTime(400); });
    // Move first to last — order should reflect
    act(() => {
      r1.result.current.fa.move(0, 2);
    });
    act(() => { vi.advanceTimersByTime(400); });
    r1.unmount();

    const stored = JSON.parse(localStorage.getItem('rhf:fa')!);
    expect(stored.state.items).toEqual([{ v: 3 }, { v: 4 }, { v: 1 }]);

    const r2 = renderHook(() => {
      const form = useForm<ItemsShape>({ defaultValues: { items: [] } });
      const fa = useFieldArray({ control: form.control, name: 'items' });
      const draft = useFormDraftRHF(form, { key: 'rhf:fa' });
      return { form, fa, draft };
    });
    expect(r2.result.current.draft.restored).toBe(true);
    expect(r2.result.current.form.getValues().items).toEqual([
      { v: 3 },
      { v: 4 },
      { v: 1 },
    ]);
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
