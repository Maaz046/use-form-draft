import { useCallback } from 'react';
import { useStore } from '@tanstack/react-form';
import type { AnyFormApi } from '@tanstack/react-form';
import {
  useFormDraft,
  type UseFormDraftOptions,
  type UseFormDraftReturn,
} from './useFormDraft';

export interface UseFormDraftTanStackOptions<T>
  extends Omit<UseFormDraftOptions<T>, 'disabled'> {
  /** Storage key. Required. */
  key: string;
  /**
   * Manually override the disabled flag. By default the adapter pauses writes while
   * the form is submitting (`form.store.state.isSubmitting`).
   */
  disabled?: boolean;
}

/**
 * TanStack Form adapter for {@link useFormDraft}. Reads the form's values from its store and
 * hydrates restored drafts via `form.reset`.
 *
 * Pass the form-data type explicitly to type the draft, e.g. `useFormDraftTanStack<TenderInput>(form, …)`.
 *
 * @example
 * const form = useForm({ defaultValues: { title: '', qty: 0 } });
 * const draft = useFormDraftTanStack<TenderInput>(form, { key: 'draft:tender:create' });
 */
export function useFormDraftTanStack<T = unknown>(
  form: AnyFormApi,
  options: UseFormDraftTanStackOptions<T>,
): UseFormDraftReturn {
  const { key, disabled, ...rest } = options;

  const values = useStore(form.store, (state) => state.values) as T;
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  const hydrate = useCallback(
    (draft: T) => {
      // keepDefaultValues: true sets the values without rewriting the form's
      // defaultValues. useForm re-applies opts.defaultValues via update() on every
      // render; if we changed them here, that update would clobber the restore on
      // the next render. This leaves defaultValues alone so the guard stays quiet.
      form.reset(draft, { keepDefaultValues: true });
    },
    [form],
  );

  return useFormDraft<T>(key, values, hydrate, {
    ...rest,
    disabled: disabled ?? isSubmitting,
  });
}
