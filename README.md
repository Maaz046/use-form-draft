# use-form-draft

> Auto-save React form drafts to `localStorage` and restore them on mount — with an optional recovery banner. Works with plain `useState`, React Hook Form, Formik, or anything that has a value and a setter.

[![CI](https://github.com/Maaz046/use-form-draft/actions/workflows/ci.yml/badge.svg)](https://github.com/Maaz046/use-form-draft/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/use-form-draft?color=cb3837)](https://www.npmjs.com/package/use-form-draft)
[![npm downloads](https://img.shields.io/npm/dm/use-form-draft?color=cb3837)](https://www.npmjs.com/package/use-form-draft)
![license](https://img.shields.io/badge/license-MIT-3b82f6)
![min+gzip](https://img.shields.io/badge/min%2Bgzip-~2%20kB-22c55e)
![runtime deps](https://img.shields.io/badge/runtime%20deps-0-22c55e)
![types](https://img.shields.io/badge/types-included-3b82f6)

Long forms get abandoned mid-fill — a switched tab, a browser crash, an accidental refresh. `use-form-draft` is the small, tested helper that quietly persists what the user has typed and offers it back when they return.

**[📦 npm](https://www.npmjs.com/package/use-form-draft)** &nbsp;·&nbsp; **[💻 GitHub](https://github.com/Maaz046/use-form-draft)** &nbsp;·&nbsp; **[🐛 Issues](https://github.com/Maaz046/use-form-draft/issues)** &nbsp;·&nbsp; **[📋 Changelog](https://github.com/Maaz046/use-form-draft/releases)**

## Contents

- [Why it exists](#why-it-exists)
- [Features](#features)
- [Install](#install)
- [Quick start](#quick-start-plain-usestate)
- [How it works](#how-it-works)
- [Recipes](#recipes)
  - [React Hook Form](#react-hook-form)
  - [Formik](#formik)
  - [Headless banner](#headless-banner)
  - [Excluding sensitive fields](#excluding-sensitive-fields)
  - [Schema versioning](#schema-versioning)
  - [Expiry (TTL)](#expiry-ttl)
  - [Cross-tab sync](#cross-tab-sync)
  - [Custom storage backends](#custom-storage-backends)
  - [Next.js & SSR](#nextjs--ssr)
  - [Theming the banner](#theming-the-banner)
  - [Internationalisation](#internationalisation)
- [API reference](#api-reference)
- [Behaviour & guarantees](#behaviour--guarantees)
- [Limitations (the v0.1 contract)](#limitations-the-v01-contract)
- [Roadmap](#roadmap)
- [How it compares](#how-it-compares)
- [FAQ](#faq)
- [Local development](#local-development)
- [Contributing](#contributing)
- [License](#license)

## Why it exists

Every team eventually writes its own "debounce the form state into `localStorage` and read it back" helper. It looks trivial, then the edge cases arrive:

- It writes the **initial empty state** over a good saved draft on first paint.
- It double-writes under React 18 **StrictMode**.
- It crashes the whole form when `localStorage` is **full or disabled** (private browsing).
- It re-persists on **identity-only re-renders** (the React Hook Form `watch()` pattern), thrashing storage.
- It hydrates a **stale draft into a changed schema** and throws.
- It keeps a **poisoned draft** that crash-loops on every remount.

`use-form-draft` is that helper with all of those handled and tested, behind a small API. No global store, no provider, no opinion about your form library.

## Features

- **Library-agnostic.** Anything with a value and a setter: `useState`, React Hook Form, Formik, or your own reducer.
- **Tiny.** ~2 kB min+gzip core, **zero runtime dependencies** beyond React. The React Hook Form and Formik adapters ship as separate `use-form-draft/rhf` and `use-form-draft/formik` entries, so you only pay for the one you import.
- **Debounced writes**, with a no-op when the persisted JSON hasn't actually changed.
- **Restore on mount** with a `savedAt` timestamp for "restored 3 minutes ago" messaging.
- **TTL expiry** — drafts older than N days are silently discarded on read.
- **Schema versioning** — bump a number to invalidate incompatible old drafts instead of crashing on them.
- **Sensitive-field exclusion** — strip passwords / CVVs before anything touches storage.
- **Recovery UI, your choice** — a themeable `<DraftBanner>`, a headless `useDraftBanner` hook, or nothing at all.
- **SSR- and StrictMode-safe** — verified by `react-dom/server` and double-mount tests, not just guards.
- **Pluggable storage** — `localStorage` (default), `sessionStorage`, or your own synchronous adapter.
- **Cross-tab aware** (opt-in) — a draft saved in one tab can restore into another.
- **Fully typed**, ESM + CJS, with bundled `.d.ts`.

## Install

```bash
npm install use-form-draft
# or
pnpm add use-form-draft
# or
yarn add use-form-draft
```

`react >= 17` is a peer dependency. `react-hook-form >= 7` and `formik >= 2` are **optional** peers — only needed if you import the `use-form-draft/rhf` or `use-form-draft/formik` entry respectively.

## Quick start (plain `useState`)

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
    'draft:tender:create', // stable storage key
    form,                  // state that drives the write
    setForm,               // hydrate: called once if a draft is found
    { disabled: saving },  // pause writes during submit
  );

  async function submit() {
    setSaving(true);
    await api.createTender(form);
    draft.clear();         // remove the stored draft on success
    setSaving(false);
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <DraftBanner savedAt={draft.savedAt} onDiscard={draft.clear} />

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

Close the tab, come back, and the form is restored with the banner reading *"Draft restored 3 minutes ago"*. On a successful submit, `draft.clear()` removes the stored draft so the next visit starts clean.

## How it works

The hook does three things, and nothing else:

1. **On mount** it reads the key once. If a draft exists, is the right schema `version`, and is younger than `ttlDays`, it calls your `hydrate` callback with the stored state and exposes `savedAt` / `hadFile`. If anything is wrong (missing, corrupt, expired, wrong version), it stays quiet.
2. **While mounted** it watches `state`. When the *persistable* JSON changes, it schedules a debounced write (default 400 ms). If the JSON is identical to what was last written — including the initial render and identity-only re-renders — it writes nothing.
3. **On `clear()`** it deletes the key, cancels any pending write, and resets its internal "last written" marker so a follow-up state reset (e.g. `setForm(empty)` after submit) doesn't immediately re-persist.

Everything is keyed off the *content* of `state`, serialised with `JSON.stringify`. If a value can't be serialised (a `BigInt`, a circular reference, a throwing `toJSON`), that write is skipped silently rather than throwing into your form.

## Recipes

### React Hook Form

Use the dedicated adapter from `use-form-draft/rhf`. It wires `form.watch()` for change tracking and `form.reset()` for hydration, and automatically pauses writes while `formState.isSubmitting` is true.

```tsx
import { useForm } from 'react-hook-form';
import { DraftBanner } from 'use-form-draft';
import { useFormDraftRHF } from 'use-form-draft/rhf';

function NewTenderForm() {
  const form = useForm<TenderInput>({ defaultValues: { title: '', qty: 0 } });
  const draft = useFormDraftRHF(form, { key: 'draft:tender:create' });

  return (
    <form onSubmit={form.handleSubmit(submit)}>
      <DraftBanner savedAt={draft.savedAt} onDiscard={draft.clear} />
      <input {...form.register('title')} />
      <input type="number" {...form.register('qty', { valueAsNumber: true })} />
      <button>Submit</button>
    </form>
  );
}
```

`useFieldArray` (dynamic rows) round-trips correctly across reloads — it's covered by a test.

### Formik

Use the adapter from `use-form-draft/formik`. It reads `formik.values`, hydrates restored drafts via `formik.setValues`, and pauses writes while `formik.isSubmitting` is true:

```tsx
import { useFormik } from 'formik';
import { DraftBanner } from 'use-form-draft';
import { useFormDraftFormik } from 'use-form-draft/formik';

function NewTenderForm() {
  const formik = useFormik<TenderInput>({
    initialValues: { title: '', qty: 0 },
    onSubmit: async (values, helpers) => {
      await api.createTender(values);
      draft.clear();
      helpers.setSubmitting(false);
    },
  });

  const draft = useFormDraftFormik(formik, { key: 'draft:tender:create' });

  return (
    <form onSubmit={formik.handleSubmit}>
      <DraftBanner savedAt={draft.savedAt} onDiscard={draft.clear} />
      <input name="title" value={formik.values.title} onChange={formik.handleChange} />
      <input name="qty" type="number" value={formik.values.qty} onChange={formik.handleChange} />
      <button type="submit">Submit</button>
    </form>
  );
}
```

Prefer wiring it by hand? The core hook is form-library-agnostic — pass `formik.values` as the state and `(saved) => formik.setValues(saved)` as the hydrate, with `disabled: formik.isSubmitting`. The adapter just packages that.

### Headless banner

If the bundled `<DraftBanner>` doesn't fit your design system, drive your own UI with `useDraftBanner`. It owns the visibility lifecycle (auto-hide, re-show on a fresh restore) and formats the relative time for you:

```tsx
import { useDraftBanner } from 'use-form-draft';

const banner = useDraftBanner({ savedAt: draft.savedAt, autoHideMs: 8000 });

return banner.visible ? (
  <MyToast onDismiss={banner.dismiss}>
    Draft restored {banner.relativeTime}
  </MyToast>
) : null;
```

### Excluding sensitive fields

Strip secrets before anything is written. Listed keys never touch `localStorage`:

```tsx
useFormDraft('draft:payment', state, hydrate, {
  exclude: ['cvv', 'cardNumber'],
});
```

> [!NOTE]
> **Type caveat (v0.1).** The `hydrate` callback's parameter is still typed as the full `T`, but at runtime the excluded keys arrive as `undefined`. Treat `draft.cvv` as `string | undefined` inside your hydrate. A precisely-typed signature (`hydrate: (draft: Omit<T, ExcludedKeys>) => void`) is planned for v0.2.

### Schema versioning

When your form's shape changes in a way old drafts can't satisfy, bump `version`. Stale drafts are discarded instead of hydrating into the new shape and crashing:

```tsx
// v1: { title: string }
// v2: { title: { en: string; ar: string } }
useFormDraft('draft:tender', state, hydrate, { version: 2 });
```

Backwards-compatible additions (a new optional field) don't need a bump.

### Expiry (TTL)

Drafts older than `ttlDays` (default **30**) are treated as absent on read and cleaned up:

```tsx
useFormDraft('draft:tender', state, hydrate, { ttlDays: 7 });
```

### Cross-tab sync

By default each tab keeps its own copy. Pass `crossTab: true` and a draft saved in one tab is restored into any other tab editing the same key — handy when a user duplicates a long form into a second tab:

```tsx
const draft = useFormDraft('draft:tender:create', form, setForm, { crossTab: true });
```

It listens for the browser's `storage` event, so it only applies to `localStorage` (the default backend). Syncing is **last-write-wins** — a save in another tab can overwrite what's being typed here — so opt in deliberately. When another tab *clears* the draft, this instance drops its "restored" badge but doesn't wipe what you're currently editing.

### Custom storage backends

The hook persists through a tiny synchronous interface, so you can point it anywhere. `window.sessionStorage` already satisfies it (tab-scoped drafts that vanish when the tab closes):

```tsx
useFormDraft('draft:tender', state, hydrate, { storage: window.sessionStorage });
```

Or supply your own adapter — namespaced, encrypted, in-memory for tests, etc:

```tsx
import type { DraftStorage } from 'use-form-draft';

const memory = new Map<string, string>();
const inMemory: DraftStorage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => void memory.set(k, v),
  removeItem: (k) => void memory.delete(k),
};

useFormDraft('draft:tender', state, hydrate, { storage: inMemory });
```

The interface is intentionally synchronous; async stores like IndexedDB aren't supported yet (see [Roadmap](#roadmap)).

### Next.js & SSR

`use-form-draft` reads `localStorage`, so it only runs on the client. In the Next.js App Router (or any React Server Components setup), mark the component that holds the form as a Client Component:

```tsx
'use client';

import { useState } from 'react';
import { useFormDraft, DraftBanner } from 'use-form-draft';

export function NewTenderForm() {
  const [form, setForm] = useState({ title: '', notes: '' });
  const draft = useFormDraft('draft:tender', form, setForm);
  // …render your fields
}
```

No extra configuration is needed. The hook never touches `window` during render, `DraftBanner` renders `null` on the server, and `useDraftBanner` returns `relativeTime: null` until after hydration — so there's no SSR/client mismatch. The same applies to Remix and other SSR frameworks.

### Theming the banner

`<DraftBanner>` is styled with inline defaults that read from CSS custom properties. Set them anywhere in your CSS to retheme every banner at once:

```css
:root {
  --ufd-banner-bg: #fffbeb;     /* background        (default) */
  --ufd-banner-border: #f59e0b; /* left accent bar   (default) */
  --ufd-banner-text: #374151;   /* message text      (default) */
  --ufd-banner-muted: #9ca3af;  /* buttons / hints   (default) */
}
```

For one-off overrides, pass `className` or `style` — both are merged onto the outer container.

### Internationalisation

Pass `locale` (drives `Intl.RelativeTimeFormat`) and `messages` to fully localise the banner:

```tsx
<DraftBanner
  savedAt={draft.savedAt}
  onDiscard={draft.clear}
  locale="ar"
  messages={{ restored: 'تم استرجاع المسودة', discard: 'تجاهل', dismiss: 'إغلاق' }}
/>
```

## API reference

### `useFormDraft<T>(key, state, hydrate, options?)`

| Param | Type | Notes |
|---|---|---|
| `key` | `string` | Stable storage key. Convention: `draft:<scope>:<qualifier>`. Must be stable for the component's lifetime — see [Limitations](#limitations-the-v01-contract). |
| `state` | `T` | Your form state. Drives the debounced write. |
| `hydrate` | `(draft: T) => void` | Called **once** on mount if a valid draft is found. Wire it to your setter. |
| `options.disabled` | `boolean` | Pause writes (use during submit). Default `false`. |
| `options.skipRestore` | `boolean` | Skip the restore-on-mount step. Default `false`. |
| `options.ttlDays` | `number` | Drafts older than this are discarded on read. Default `30`. |
| `options.version` | `number` | Schema version. Bump to invalidate old drafts. Default `1`. |
| `options.exclude` | `ReadonlyArray<keyof T>` | Keys stripped before persisting (passwords, CVVs). |
| `options.hasFile` | `boolean` | Stored as a flag so the banner can prompt re-attach. File *content* is never persisted. Default `false`. |
| `options.debounceMs` | `number` | Write debounce window. Default `400`. |
| `options.storage` | `DraftStorage` | Where to persist. Default `window.localStorage`. Pass `window.sessionStorage` or a custom synchronous adapter. |
| `options.crossTab` | `boolean` | Restore a draft saved in another tab into this one (localStorage only, last-write-wins). Default `false`. |

**Returns** `UseFormDraftReturn`:

| Field | Type | Notes |
|---|---|---|
| `restored` | `boolean` | True if a draft was found and hydrated on mount. |
| `savedAt` | `Date \| null` | When the restored draft was last saved, else `null`. |
| `hadFile` | `boolean` | Whether the restored draft had a file flagged. |
| `clear` | `() => void` | Delete the persisted draft and reset hook state. Call on successful submit. |

### `<DraftBanner />`

| Prop | Type | Default | Notes |
|---|---|---|---|
| `savedAt` | `Date \| null` | — | From `useFormDraft().savedAt`. Renders nothing while `null`. |
| `onDiscard` | `() => void` | — | Wire to `useFormDraft().clear`. |
| `hadFile` | `boolean` | `false` | Appends a "re-attach file" hint when true. |
| `autoHideMs` | `number` | `10000` | ms before auto-hide. `0` disables it. The 10 s default follows WAI-ARIA live-region guidance — shorter is risky for screen-reader users. |
| `escDismiss` | `boolean` | `false` | Adds a **document-level** Escape listener. Leave off if your app has modals that handle Esc themselves, or the banner will be dismissed alongside them. |
| `locale` | `string` | `'en'` | For `Intl.RelativeTimeFormat`. |
| `messages` | `object` | — | `{ restored, reattach, discard, dismiss }` string overrides. |
| `closeIcon` | `ReactNode` | `'×'` | Override the close glyph. |
| `className` | `string` | — | Applied to the outer container. |
| `style` | `CSSProperties` | — | Merged onto the outer container. |

The banner is a `role="status"` live region. It is intentionally a status message, not a full alert dialog (see [Roadmap](#roadmap)).

### `useDraftBanner(options)`

Headless banner state. `options`: `{ savedAt: Date | null; autoHideMs?: number; locale?: string }`.

**Returns** `{ visible: boolean; dismiss: () => void; relativeTime: string | null }`. `relativeTime` is `null` until after mount (SSR-safe) and whenever `savedAt` is `null`.

### `useFormDraftRHF(form, options)` — `use-form-draft/rhf`

React Hook Form adapter. `form` is a `UseFormReturn<T>`. `options` takes every `useFormDraft` option **except** `disabled`, plus a **required** `key`. It supplies `state` and `hydrate` automatically and disables writes while `formState.isSubmitting` is true (pass `disabled` to override). Returns the same `UseFormDraftReturn`.

### `useFormDraftFormik(formik, options)` — `use-form-draft/formik`

Formik adapter. `formik` is the bag returned by `useFormik` / `<Formik>` (a `FormikProps<T>`). `options` takes every `useFormDraft` option **except** `disabled`, plus a **required** `key`. It persists `formik.values`, hydrates via `formik.setValues`, and disables writes while `formik.isSubmitting` is true (pass `disabled` to override). Returns the same `UseFormDraftReturn`.

### `DraftStorage`

The storage interface accepted by `options.storage`: `{ getItem(key): string | null; setItem(key, value): void; removeItem(key): void }`. `window.localStorage` and `window.sessionStorage` satisfy it out of the box.

### `DraftPayload<T>`

The exported shape of what's stored in `localStorage`: `{ version: number; savedAt: string; hadFile: boolean; state: T }` (`savedAt` is an ISO string on disk; the hook hands you a `Date`).

## Behaviour & guarantees

These are all covered by tests, not just intentions:

- **`localStorage` unavailable** (private browsing, quota exceeded, disabled): every read/write is a silent no-op. The host form never crashes.
- **Corrupted JSON** in storage: discarded as if absent.
- **Hydrate throws:** the draft is deleted so a remount doesn't keep crashing on it.
- **React 18 StrictMode:** the intentional double-mount does **not** write the initial state over a good draft.
- **SSR (Next.js, Remix):** `useFormDraft` renders without touching `window`; `<DraftBanner>` returns `null` on the server; `useDraftBanner` returns `relativeTime: null` until after mount — no hydration mismatch.
- **Rapid input:** writes are debounced.
- **Identity-only re-renders:** if `state` is a new object each render but its persistable JSON is unchanged (the RHF `watch()` pattern), nothing is written. Writes fire only when the JSON actually differs.
- **Non-serialisable state** (`BigInt`, circular refs, throwing `toJSON`): that write is skipped silently.

## Limitations (the v0.1 contract)

Known and deliberate for this version — call them out so you don't get surprised:

- **The `key` must be stable for the component's lifetime.** Changing it while mounted has two failure modes: (1) the new key's existing draft is **not** restored (the restore effect runs once, on mount); (2) a pending debounced write for the old key still lands on the old key. If your key depends on a route param or entity id, unmount + remount the component instead — e.g. `<Form key={id} />` so React swaps the instance. Native key-change handling is planned for v0.2.
- **Same-key concurrency is last-write-wins.** Two components mounted with the same `key` at once will race. The typical pattern — one form open per key — is safe.
- **Cross-tab sync is opt-in and last-write-wins.** With `crossTab: true`, a save in another tab can overwrite what's being edited here — there's no automatic merge or conflict resolution.
- **Synchronous storage only.** `localStorage` (default), `sessionStorage`, and custom sync adapters work via `storage`; async stores like IndexedDB aren't supported by the interface yet.
- **The `exclude` type caveat** described [above](#excluding-sensitive-fields).

## Roadmap

Not done yet, planned:

- Native `key`-change handling.
- An **async** storage-adapter interface for IndexedDB (large drafts, file metadata, rich text). Synchronous backends — `localStorage`, `sessionStorage`, custom adapters — already work via `storage`.
- Precisely-typed `exclude` (`Omit<T, ExcludedKeys>` in the hydrate signature).
- Banner: focus management and ARIA alert escalation.
- Optional encryption at rest.

## How it compares

An honest sketch — feature columns and last-release dates were checked against `npm view <pkg>` and each package's README at the time of writing. Pick the one that fits; none is universally right.

| Package | Form-lib-agnostic | Bundled recovery UI | Server autosave | Storage |
|---|:-:|:-:|:-:|---|
| **use-form-draft** | ✅ | ✅ banner + headless hook | ❌ | localStorage |
| `react-hook-form-persist` | ❌ RHF only | ❌ | ❌ | local / session |
| `react-hook-form-autosave` | ❌ RHF only | ❌ | ✅ | server |
| `@ryanflorence/persist-form` | ✅ vanilla HTML form | ❌ | ❌ | sessionStorage |
| `@zippers/savior` | ✅ framework-free | ❌ | ❌ | local / session |
| `form-snapshots` | ✅ | ❌ snapshot history | ❌ | IndexedDB (Dexie) |

**When to pick something else:** if you only use React Hook Form and don't need a banner, `react-hook-form-persist` does the persistence job in fewer bytes. If you want autosave to a *server* (not a local draft), use `react-hook-form-autosave`. If you need snapshot history with undo, look at `form-snapshots`. If you're working with vanilla DOM forms (no framework), `@zippers/savior` is purpose-built for that.

`use-form-draft` targets the *closed-the-tab-and-came-back* recovery flow specifically, with a React-idiomatic API, a bundled banner UX, and support for any form library.

## FAQ

**Where is the draft stored?** In `window.localStorage`, under the `key` you pass, as a JSON [`DraftPayload`](#draftpayloadt). Nothing leaves the browser.

**Is it safe for passwords / card numbers?** Use [`exclude`](#excluding-sensitive-fields) to strip them before they're written. There's no encryption at rest yet (it's on the [roadmap](#roadmap)) — don't rely on `localStorage` for secrets you wouldn't want readable by other scripts on the origin.

**Does it autosave to my backend?** No — it's a *local* draft, not server autosave. For server autosave, see [`react-hook-form-autosave`](#how-it-compares).

**Does it work outside React?** No. The core is a React hook.

**Does it support uncontrolled inputs?** It persists whatever state you hand it. For React Hook Form (largely uncontrolled), use the [adapter](#react-hook-form), which reads via `watch()`.

**Will it write my empty initial form over a saved draft?** No — that's one of the specific cases it's built and tested to avoid.

## Local development

```bash
git clone https://github.com/Maaz046/use-form-draft.git
cd use-form-draft
npm install

npm test          # run the test suite (vitest)
npm run typecheck # tsc --noEmit
npm run build     # bundle ESM + CJS + .d.ts with tsup
```

To test an unreleased change against another local project, build it and install the folder (or `npm pack` it and install the resulting tarball):

```bash
npm run build
npm install /absolute/path/to/use-form-draft
```

## Contributing

Issues and PRs are welcome. Please run `npm run typecheck && npm test && npm run build` before opening a PR — CI runs all three across Node 18, 20, and 22.

## License

[MIT](./LICENSE)
