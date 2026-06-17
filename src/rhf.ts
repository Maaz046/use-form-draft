import { useCallback } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';
import {
  useFormDraft,
  type UseFormDraftOptions,
  type UseFormDraftReturn,
} from './useFormDraft';

export interface UseFormDraftRHFOptions<T extends FieldValues>
  extends Omit<UseFormDraftOptions<T>, 'disabled'> {
  /** Storage key. Required. */
  key: string;
  /**
   * Manually override the disabled flag. By default the adapter disables writes while
   * `form.formState.isSubmitting` is true.
   */
  disabled?: boolean;
}

/**
 * React Hook Form adapter for {@link useFormDraft}. Wires `form.watch()` to track field changes
 * and `form.reset()` to hydrate restored drafts.
 *
 * @example
 * const form = useForm<TenderInput>({ defaultValues: { title: '', items: [] } });
 * const draft = useFormDraftRHF(form, { key: 'draft:tender:create' });
 */
export function useFormDraftRHF<T extends FieldValues>(
  form: UseFormReturn<T>,
  options: UseFormDraftRHFOptions<T>,
): UseFormDraftReturn {
  const { key, disabled, ...rest } = options;
  const state = form.watch();
  const isSubmitting = form.formState.isSubmitting;

  const hydrate = useCallback(
    (draft: T) => {
      form.reset(draft);
    },
    [form],
  );

  return useFormDraft<T>(key, state as T, hydrate, {
    ...rest,
    disabled: disabled ?? isSubmitting,
  });
}
