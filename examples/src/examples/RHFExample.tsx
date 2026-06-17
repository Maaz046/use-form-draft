import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { DraftBanner } from 'use-form-draft';
import { useFormDraftRHF } from 'use-form-draft/rhf';

interface Tender {
  title: string;
  qty: number;
  description: string;
}

const defaults: Tender = { title: '', qty: 0, description: '' };

export function RHFExample() {
  const [submittedAt, setSubmittedAt] = useState<Date | null>(null);
  const form = useForm<Tender>({ defaultValues: defaults });
  const draft = useFormDraftRHF(form, { key: 'draft:rhf' });

  async function onSubmit() {
    await new Promise((r) => setTimeout(r, 600));
    draft.clear();
    form.reset(defaults);
    setSubmittedAt(new Date());
  }

  return (
    <div className="panel">
      <div className="form-col">
        <h2>New tender (React Hook Form)</h2>
        {submittedAt && <div className="success">Submitted ✓ (draft cleared)</div>}
        <DraftBanner
          savedAt={draft.savedAt}
          hadFile={draft.hadFile}
          onDiscard={draft.clear}
          autoHideMs={0}
        />
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <label>
            Title
            <input type="text" {...form.register('title')} placeholder="e.g. Sugar 500T procurement" />
          </label>
          <label>
            Quantity (tons)
            <input type="number" {...form.register('qty', { valueAsNumber: true })} />
          </label>
          <label>
            Description
            <textarea
              {...form.register('description')}
              placeholder="Delivery terms, payment terms, specifications…"
            />
          </label>
          <button className="submit" type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Submitting…' : 'Submit tender'}
          </button>
        </form>
      </div>

      <div className="desc-col">
        <h3>What's happening</h3>
        <p>
          The RHF adapter wires <code>form.watch()</code> for change tracking and{' '}
          <code>form.reset()</code> for hydration. Writes pause automatically while{' '}
          <code>formState.isSubmitting</code> is true.
        </p>
        <pre>{`import { useForm } from 'react-hook-form';
import { useFormDraftRHF } from 'use-form-draft/rhf';
import { DraftBanner } from 'use-form-draft';

const form = useForm<Tender>({ defaultValues });
const draft = useFormDraftRHF(form, {
  key: 'draft:rhf',
});

return (
  <form onSubmit={form.handleSubmit(submit)}>
    <DraftBanner
      savedAt={draft.savedAt}
      onDiscard={draft.clear}
    />
    <input {...form.register('title')} />
    {/* … */}
  </form>
);`}</pre>
        <div className="try">
          <strong>Try it:</strong> type into Title, reload the page (Cmd-R) — RHF rehydrates from
          your draft.
        </div>
      </div>
    </div>
  );
}
