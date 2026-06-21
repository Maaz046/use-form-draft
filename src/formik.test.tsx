import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormik } from 'formik';
import { useFormDraftFormik } from './formik';

interface Shape {
  title: string;
  qty: number;
}

const noop = () => {};

describe('useFormDraftFormik', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('persists form values after they change (debounced)', async () => {
    const { result } = renderHook(() => {
      const formik = useFormik<Shape>({ initialValues: { title: '', qty: 0 }, onSubmit: noop });
      const draft = useFormDraftFormik(formik, { key: 'fmk:test' });
      return { formik, draft };
    });

    await act(async () => {
      await result.current.formik.setValues({ title: 'tender X', qty: 25 });
    });
    act(() => { vi.advanceTimersByTime(400); });

    const stored = JSON.parse(localStorage.getItem('fmk:test')!);
    expect(stored.state).toMatchObject({ title: 'tender X', qty: 25 });
  });

  it('hydrates form values from a stored draft via setValues on mount', () => {
    localStorage.setItem('fmk:test', JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      hadFile: false,
      state: { title: 'restored title', qty: 99 },
    }));

    const { result } = renderHook(() => {
      const formik = useFormik<Shape>({ initialValues: { title: '', qty: 0 }, onSubmit: noop });
      const draft = useFormDraftFormik(formik, { key: 'fmk:test' });
      return { formik, draft };
    });

    expect(result.current.draft.restored).toBe(true);
    expect(result.current.formik.values).toEqual({ title: 'restored title', qty: 99 });
  });

  it('does not persist while formik.isSubmitting is true', async () => {
    const { result } = renderHook(() => {
      const formik = useFormik<Shape>({
        initialValues: { title: '', qty: 0 },
        // a submit handler that never resolves keeps isSubmitting true
        onSubmit: () => new Promise<void>(noop),
      });
      const draft = useFormDraftFormik(formik, { key: 'fmk:submitting' });
      return { formik, draft };
    });

    await act(async () => {
      await result.current.formik.setValues({ title: 'typed', qty: 1 });
      result.current.formik.handleSubmit();
    });
    act(() => { vi.advanceTimersByTime(400); });

    expect(result.current.formik.isSubmitting).toBe(true);
    expect(localStorage.getItem('fmk:submitting')).toBeNull();
  });

  it('clear() empties storage and resets the restored flag', () => {
    localStorage.setItem('fmk:test', JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      hadFile: false,
      state: { title: 'x', qty: 1 },
    }));

    const { result } = renderHook(() => {
      const formik = useFormik<Shape>({ initialValues: { title: '', qty: 0 }, onSubmit: noop });
      const draft = useFormDraftFormik(formik, { key: 'fmk:test' });
      return { formik, draft };
    });

    expect(result.current.draft.restored).toBe(true);
    act(() => { result.current.draft.clear(); });

    expect(localStorage.getItem('fmk:test')).toBeNull();
    expect(result.current.draft.restored).toBe(false);
  });
});
