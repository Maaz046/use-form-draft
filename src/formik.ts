import { useCallback } from 'react';
import type { FormikProps, FormikValues } from 'formik';
import {
  useFormDraft,
  type UseFormDraftOptions,
  type UseFormDraftReturn,
} from './useFormDraft';

export interface UseFormDraftFormikOptions<T extends FormikValues>
  extends Omit<UseFormDraftOptions<T>, 'disabled'> {
  /** Storage key. Required. */
  key: string;
  /**
   * Manually override the disabled flag. By default the adapter disables writes while
   * `formik.isSubmitting` is true.
   */
  disabled?: boolean;
}

/**
 * Formik adapter for {@link useFormDraft}. Persists `formik.values` and hydrates restored
 * drafts via `formik.setValues`.
 *
 * @example
 * const formik = useFormik<TenderInput>({ initialValues: { title: '', qty: 0 }, onSubmit });
 * const draft = useFormDraftFormik(formik, { key: 'draft:tender:create' });
 */
export function useFormDraftFormik<T extends FormikValues>(
  formik: FormikProps<T>,
  options: UseFormDraftFormikOptions<T>,
): UseFormDraftReturn {
  const { key, disabled, ...rest } = options;

  const hydrate = useCallback(
    (draft: T) => {
      formik.setValues(draft);
    },
    [formik],
  );

  return useFormDraft<T>(key, formik.values, hydrate, {
    ...rest,
    disabled: disabled ?? formik.isSubmitting,
  });
}
