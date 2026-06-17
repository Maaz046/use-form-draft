import { useState } from 'react';
import { useFormik } from 'formik';
import { useFormDraft, DraftBanner } from 'use-form-draft';

interface Tender {
  title: string;
  qty: number;
  description: string;
}

const initialValues: Tender = { title: '', qty: 0, description: '' };

export function FormikExample() {
  const [submittedAt, setSubmittedAt] = useState<Date | null>(null);

  const formik = useFormik<Tender>({
    initialValues,
    onSubmit: async () => {
      await new Promise((r) => setTimeout(r, 600));
      draft.clear();
      formik.resetForm({ values: initialValues });
      setSubmittedAt(new Date());
    },
  });

  const draft = useFormDraft<Tender>(
    'draft:formik',
    formik.values,
    (saved) => formik.setValues(saved, false),
    { disabled: formik.isSubmitting },
  );

  return (
    <div className="panel">
      <div className="form-col">
        <h2>New tender (Formik)</h2>
        {submittedAt && <div className="success">Submitted ✓ (draft cleared)</div>}
        <DraftBanner
          savedAt={draft.savedAt}
          hadFile={draft.hadFile}
          onDiscard={draft.clear}
          autoHideMs={0}
        />
        <form onSubmit={formik.handleSubmit}>
          <label>
            Title
            <input
              type="text"
              name="title"
              value={formik.values.title}
              onChange={formik.handleChange}
              placeholder="e.g. Sugar 500T procurement"
            />
          </label>
          <label>
            Quantity (tons)
            <input
              type="number"
              name="qty"
              value={formik.values.qty}
              onChange={formik.handleChange}
            />
          </label>
          <label>
            Description
            <textarea
              name="description"
              value={formik.values.description}
              onChange={formik.handleChange}
              placeholder="Delivery terms, payment terms, specifications…"
            />
          </label>
          <button className="submit" type="submit" disabled={formik.isSubmitting}>
            {formik.isSubmitting ? 'Submitting…' : 'Submit tender'}
          </button>
        </form>
      </div>

      <div className="desc-col">
        <h3>What's happening</h3>
        <p>
          No Formik adapter needed — the core <code>useFormDraft</code> hook takes any state value
          and a setter. Here we wire it directly to Formik's <code>values</code> and{' '}
          <code>setValues</code>.
        </p>
        <pre>{`import { useFormik } from 'formik';
import { useFormDraft, DraftBanner } from 'use-form-draft';

const formik = useFormik<Tender>({ initialValues, onSubmit });

const draft = useFormDraft(
  'draft:formik',
  formik.values,
  (saved) => formik.setValues(saved, false),
  { disabled: formik.isSubmitting },
);`}</pre>
        <div className="try">
          <strong>Try it:</strong> this same pattern works with any state shape — Zustand, Jotai, a
          custom reducer. The hook only needs a value + a setter.
        </div>
      </div>
    </div>
  );
}
