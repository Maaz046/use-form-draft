# use-form-draft

Auto-save React form drafts to `localStorage` and restore them on mount, with an opt-in recovery banner.
Works with plain `useState`, React Hook Form, Formik — anything that has a state value and a setter.

- ~4 KB ESM core, zero runtime dependencies beyond React
- Bring your own form library (or none)
- TTL, schema-version invalidation, sensitive-field exclusion built in
- Optional themable banner + a headless hook if you want to roll your own UI
- React Hook Form adapter shipped under `use-form-draft/rhf`

## Why this exists

Long forms get abandoned mid-fill — switched tabs, browser crash, accidental refresh. Every team eventually
writes their own debounced-write-to-localStorage helper, gets the TTL or the schema-version edge case
wrong, and ships it half-finished. This is that helper, productised and tested.

## Install

```bash
npm install use-form-draft
# or
pnpm add use-form-draft
# or
yarn add use-form-draft
```

React 17+ peer dependency. React Hook Form is an *optional* peer — only required if you import the
`use-form-draft/rhf` entry.

## 30-second example (plain useState)

```tsx
import { useState } from 'react';
import { useFormDraft, DraftBanner } from 'use-form-draft';

interface TenderInput {
  title: string;
  qty: number;
}

function NewTenderForm() {
  const [form, setForm] = useState<TenderInput>({ title: '', qty: 0 });
  const [saving, setSaving] = useState(false);

  const draft = useFormDraft<TenderInput>(
    'draft:tender:create',
    form,
    setForm, // hydrate
    { disabled: saving },
  );

  async function submit() {
    setSaving(true);
    await api.createTender(form);
    draft.clear(); // remove the stored draft on success
    setSaving(false);
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <DraftBanner
        savedAt={draft.savedAt}
        hadFile={draft.hadFile}
        onDiscard={draft.clear}
      />
      <input
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />
      <input
        type="number"
        value={form.qty}
        onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })}
      />
      <button disabled={saving}>Submit</button>
    </form>
  );
}
```

That's it. Close the tab, come back, the form is restored and the banner says *"Draft restored 3 minutes ago"*.

## React Hook Form

```tsx
import { useForm } from 'react-hook-form';
import { DraftBanner } from 'use-form-draft';
import { useFormDraftRHF } from 'use-form-draft/rhf';

function NewTenderForm() {
  const form = useForm<TenderInput>({ defaultValues: { title: '', qty: 0 } });
  const draft = useFormDraftRHF(form, { key: 'draft:tender:create' });

  return (
    <form onSubmit={form.handleSubmit(submit)}>
      <DraftBanner
        savedAt={draft.savedAt}
        hadFile={draft.hadFile}
        onDiscard={draft.clear}
      />
      <input {...form.register('title')} />
      <input type="number" {...form.register('qty', { valueAsNumber: true })} />
      <button>Submit</button>
    </form>
  );
}
```

The adapter wires `form.watch()` for change tracking and `form.reset()` for hydration. Writes are
automatically paused while `formState.isSubmitting` is true.

## Headless banner

If the bundled `<DraftBanner>` doesn't fit your design system, drive your own UI with `useDraftBanner`:

```tsx
import { useDraftBanner } from 'use-form-draft';

const banner = useDraftBanner({
  savedAt: draft.savedAt,
  autoHideMs: 8000,
});

return banner.visible ? (
  <MyOwnToast onDismiss={banner.dismiss}>
    Draft restored {banner.relativeTime}
  </MyOwnToast>
) : null;
```

## API

### `useFormDraft<T>(key, state, hydrate, options?)`

| Param | Type | Notes |
|---|---|---|
| `key` | `string` | Stable storage key. Convention: `draft:<scope>:<qualifier>` |
| `state` | `T` | Your form state. Drives the debounced write. |
| `hydrate` | `(draft: T) => void` | Called once on mount if a valid draft is found. |
| `options.disabled` | `boolean` | Pause writes (use during submit). |
| `options.skipRestore` | `boolean` | Skip restore-on-mount. |
| `options.ttlDays` | `number` | Default 30. Drafts older than this are discarded. |
| `options.hasFile` | `boolean` | Stored as a flag so the banner can prompt re-attach. |
| `options.version` | `number` | Schema version. Bump to invalidate old drafts. Default 1. |
| `options.exclude` | `(keyof T)[]` | Strip keys before persisting (passwords, CVVs). |
| `options.debounceMs` | `number` | Default 400. |

**Returns**: `{ restored, savedAt, hadFile, clear }`.

### `<DraftBanner />`

Themable via CSS custom properties — set them anywhere in your CSS to override defaults:

```css
:root {
  --ufd-banner-bg: #fff7f0;
  --ufd-banner-border: #f26422;
  --ufd-banner-text: #374151;
  --ufd-banner-muted: #9ca3af;
}
```

Or pass `className` / `style` for one-off overrides. Pass `messages` for i18n.

### `useDraftBanner(options)`

Headless variant. Returns `{ visible, dismiss, relativeTime }`.

### `useFormDraftRHF(form, options)` (`use-form-draft/rhf`)

React Hook Form adapter. Same options as `useFormDraft`, plus a required `key`. The `state` and `hydrate`
arguments are wired automatically.

## Schema versioning — when to bump `version`

You'll need to bump when your form's shape changes incompatibly:

```tsx
// v1: { title: string }
// v2: { title: { en: string; ar: string } }
useFormDraft('draft:tender', state, hydrate, { version: 2 });
```

Old `v1` drafts in `localStorage` will be silently discarded instead of hydrating into the new shape and
crashing the form. Backwards-compatible additions don't need a version bump.

## Excluding sensitive fields

```tsx
useFormDraft('draft:payment', state, hydrate, {
  exclude: ['cvv', 'cardNumber'],
});
```

These keys are stripped before the write. They never touch `localStorage`.

## Edge cases handled

- `localStorage` unavailable (private browsing, quota exceeded, disabled by user): silent no-ops
- Corrupted JSON in storage: discarded
- Hydrate callback throws: draft discarded so a re-mount doesn't keep crashing
- SSR (Next.js, Remix): guarded — no `localStorage` reads on the server
- Rapid input: writes are debounced; the trailing call is the one that lands

## How this compares

There are several form-persistence libraries in the React ecosystem. This is an honest sketch — pick the
one that fits, none is universally right.

| Package | Form-library-agnostic | Bundled recovery UI | Server-autosave | Storage backend | Status |
|---|:-:|:-:|:-:|---|---|
| **use-form-draft** | ✅ | ✅ banner + headless hook | ❌ | localStorage | New (this one) |
| `react-hook-form-persist` | ❌ RHF only | ❌ | ❌ | localStorage / sessionStorage | Unmaintained since 2022 |
| `react-hook-form-autosave` | ❌ RHF only | ❌ | ✅ | server | Active |
| `@ryanflorence/persist-form` | ✅ vanilla HTML form | ❌ | ❌ | localStorage | Active |
| `@zippers/savior` | ✅ | partial | ❌ | localStorage | Active |
| `form-snapshots` | ❌ React only | ❌ snapshot history | ❌ | IndexedDB (Dexie) | Active |

If you only use React Hook Form and don't need a banner, `react-hook-form-persist` does the persistence
job in fewer bytes. If you want autosave to a server (not a localStorage draft), use
`react-hook-form-autosave`. If you need snapshot history with undo, look at `form-snapshots`.
`use-form-draft` is targeted at the *closed-the-tab-and-came-back* recovery flow with a bundled banner UX
and any form library.

## Try it locally

```bash
git clone https://github.com/Maaz046/use-form-draft.git
cd use-form-draft
npm install
npm --prefix examples install
npm run demo
```

Opens a live demo at `http://localhost:5173` with three working examples (vanilla useState, React Hook Form, Formik). Type into any form, close the tab, reopen — the draft is restored.

## What's NOT in v0.1 (planned)

- Cross-tab coordination via the `storage` event
- IndexedDB storage adapter for large drafts
- `sessionStorage` adapter
- Encryption at rest

PRs welcome.

## License

MIT
