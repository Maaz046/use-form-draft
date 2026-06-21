# Changelog

All notable changes to `use-form-draft` are documented here. This project follows
[Semantic Versioning](https://semver.org/) and the [Keep a Changelog](https://keepachangelog.com/) format.

## [0.3.0]

### Added
- **Formik adapter** under `use-form-draft/formik` (`useFormDraftFormik`). Persists `formik.values`,
  hydrates via `formik.setValues`, and pauses writes while `formik.isSubmitting` is true. `formik` is
  an optional peer dependency — you only pay for it if you import this entry.

### Changed
- Expanded npm `keywords` (sessionstorage, formik, cross-tab) for discoverability.

## [0.2.0]

### Added
- **Cross-tab sync** via the opt-in `crossTab` option. A draft saved in another tab is restored into
  this one through the `storage` event (localStorage only, last-write-wins). Clearing in another tab
  drops the "restored" badge without wiping in-progress edits.
- **Pluggable storage** via the `storage` option and the exported `DraftStorage` interface. Defaults to
  `window.localStorage`; pass `window.sessionStorage` or any synchronous adapter.

### Changed
- Internal: the relative-time formatter is now shared between `DraftBanner` and `useDraftBanner`
  instead of duplicated.

## [0.1.0]

Initial release.

### Added
- `useFormDraft(key, state, hydrate, options)` — debounced persistence to `localStorage` with restore
  on mount, TTL expiry, schema-version invalidation, and sensitive-field exclusion.
- `DraftBanner` — themeable recovery UI driven by CSS custom properties, with i18n and `escDismiss`.
- `useDraftBanner` — headless banner state (`visible`, `dismiss`, `relativeTime`).
- `useFormDraftRHF` — React Hook Form adapter under `use-form-draft/rhf`.
- React 18 StrictMode and SSR safety, verified by tests.
- Dual ESM/CJS build with bundled type declarations; CI on Node 18, 20, and 22.

[0.3.0]: https://github.com/Maaz046/use-form-draft/releases/tag/v0.3.0
[0.2.0]: https://github.com/Maaz046/use-form-draft/releases/tag/v0.2.0
[0.1.0]: https://github.com/Maaz046/use-form-draft/releases/tag/v0.1.0
