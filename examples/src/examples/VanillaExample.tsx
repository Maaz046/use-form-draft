import { useState } from 'react';
import { useFormDraft, DraftBanner } from 'use-form-draft';

interface Tender {
  title: string;
  qty: number;
  description: string;
}

const empty: Tender = { title: '', qty: 0, description: '' };

export function VanillaExample() {
  const [form, setForm] = useState<Tender>(empty);
  const [saving, setSaving] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<Date | null>(null);

  const draft = useFormDraft<Tender>('draft:vanilla', form, setForm, { disabled: saving });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    draft.clear();
    setForm(empty);
    setSubmittedAt(new Date());
    setSaving(false);
  }

  return (
    <div className="panel">
      <div className="form-col">
        <h2>New tender</h2>
        {submittedAt && <div className="success">Submitted ✓ (draft cleared)</div>}
        <DraftBanner
          savedAt={draft.savedAt}
          hadFile={draft.hadFile}
          onDiscard={draft.clear}
          autoHideMs={0}
        />
        <form onSubmit={onSubmit}>
          <label>
            Title
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Sugar 500T procurement"
            />
          </label>
          <label>
            Quantity (tons)
            <input
              type="number"
              value={form.qty}
              onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })}
            />
          </label>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Delivery terms, payment terms, specifications…"
            />
          </label>
          <button className="submit" type="submit" disabled={saving}>
            {saving ? 'Submitting…' : 'Submit tender'}
          </button>
        </form>
      </div>

      <div className="desc-col">
        <h3>What's happening</h3>
        <p>
          A plain <code>useState</code> form. The <code>useFormDraft</code> hook watches{' '}
          <code>form</code> and writes a debounced snapshot to <code>localStorage</code> after every
          change.
        </p>
        <pre>{`const [form, setForm] = useState(empty);

const draft = useFormDraft(
  'draft:vanilla',
  form,
  setForm,
  { disabled: saving },
);

return (
  <>
    <DraftBanner
      savedAt={draft.savedAt}
      hadFile={draft.hadFile}
      onDiscard={draft.clear}
    />
    {/* fields */}
  </>
);`}</pre>
        <div className="try">
          <strong>Try it:</strong> type a title, close this tab, reopen — your draft is restored
          with a banner.
        </div>
      </div>
    </div>
  );
}
