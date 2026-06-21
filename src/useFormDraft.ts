import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Minimal synchronous storage interface. The Web Storage API
 * (`window.localStorage` / `window.sessionStorage`) satisfies it as-is, and
 * you can supply your own adapter (in-memory, encrypted, namespaced, …) as
 * long as it stays synchronous.
 */
export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Resolve the storage backend: an explicit adapter, else localStorage, else null (SSR). */
function resolveStorage(custom?: DraftStorage): DraftStorage | null {
  if (custom) return custom;
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    return window.localStorage;
  }
  return null;
}

export interface DraftPayload<T> {
  version: number;
  savedAt: string;
  hadFile: boolean;
  state: T;
}

export interface UseFormDraftOptions<T> {
  /** Disables writes while true. Set to true during submit so the in-flight payload isn't persisted. */
  disabled?: boolean;
  /** Skip the restore-on-mount step. Useful for one-shot dismissals. */
  skipRestore?: boolean;
  /** Drafts older than this are discarded silently on read. Default 30. */
  ttlDays?: number;
  /** Whether the form currently has a file attached. Stored as a flag so the banner can prompt re-attach. */
  hasFile?: boolean;
  /**
   * Schema version. Bump this when your state shape changes incompatibly — old drafts will be discarded
   * instead of hydrating into the new shape and crashing. Default 1.
   */
  version?: number;
  /** Keys to strip from state before persisting (passwords, CVVs, one-time tokens). */
  exclude?: ReadonlyArray<keyof T>;
  /** Debounce window in ms for writes. Default 400. */
  debounceMs?: number;
  /**
   * Where to persist. Defaults to `window.localStorage`. Pass `window.sessionStorage` for
   * tab-scoped drafts, or any object implementing {@link DraftStorage}. Must be synchronous —
   * async stores (IndexedDB) aren't supported by this interface yet.
   */
  storage?: DraftStorage;
  /**
   * Keep this instance in sync with edits made in other tabs of the same origin. When true, a
   * draft saved in another tab is restored into this one via the `storage` event. Default false.
   *
   * Only meaningful with `localStorage` (the default) — the `storage` event does not fire for
   * `sessionStorage` (tab-scoped) or for custom adapters. Syncing is last-write-wins, so a remote
   * save can overwrite what the user is currently editing here; opt in deliberately.
   */
  crossTab?: boolean;
}

export interface UseFormDraftReturn {
  /** True if a draft was found and successfully hydrated on mount. */
  restored: boolean;
  /** When the restored draft was last saved, or null if no draft was restored. */
  savedAt: Date | null;
  /** Whether the restored draft had a file attached (file content itself is never persisted). */
  hadFile: boolean;
  /** Remove the persisted draft and reset hook state. Call on successful submit. */
  clear: () => void;
}

function safeGet<T>(
  storage: DraftStorage | null,
  key: string,
  ttlDays: number,
  version: number,
): DraftPayload<T> | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw) as DraftPayload<T>;
    if (p.version !== version) return null;
    const ageMs = Date.now() - new Date(p.savedAt).getTime();
    if (ageMs > ttlDays * 86_400_000) return null;
    return p;
  } catch {
    return null;
  }
}

function safeSet<T>(
  storage: DraftStorage | null,
  key: string,
  state: T,
  hadFile: boolean,
  version: number,
): void {
  if (!storage) return;
  try {
    const p: DraftPayload<T> = {
      version,
      savedAt: new Date().toISOString(),
      hadFile,
      state,
    };
    storage.setItem(key, JSON.stringify(p));
  } catch {
    /* quota exceeded / private browsing / disabled */
  }
}

function safeDel(storage: DraftStorage | null, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

type Persistable<T, E extends ReadonlyArray<keyof T>> = E extends ReadonlyArray<never>
  ? T
  : Omit<T, E[number]>;

function stripExcluded<T, E extends ReadonlyArray<keyof T>>(
  state: T,
  exclude: E | undefined,
): Persistable<T, E> {
  if (!exclude || exclude.length === 0) return state as unknown as Persistable<T, E>;
  if (state === null || typeof state !== 'object') return state as unknown as Persistable<T, E>;
  const copy = { ...(state as Record<string, unknown>) };
  for (const key of exclude) {
    delete copy[key as string];
  }
  return copy as unknown as Persistable<T, E>;
}

/**
 * Stringify safely. Returns null if the payload contains a non-serializable
 * value (BigInt, circular reference, throwing toJSON, Symbol). Callers treat
 * null as "skip this write" — we'd rather silently no-op than crash the form.
 */
function safeStringify(payload: unknown): string | null {
  try {
    return JSON.stringify(payload);
  } catch {
    return null;
  }
}

/**
 * Auto-saves form state to a synchronous store (localStorage by default) with a debounced write,
 * and restores it on mount.
 *
 * @param key      Storage key. **Must be stable for the component's lifetime in v0.1.** Changing
 *                 the key while mounted has two failure modes: (1) the new key's existing draft
 *                 is NOT restored (the restore effect runs once on mount); (2) any pending
 *                 debounced write for the old key still writes to the old key. If you need a key
 *                 that depends on a route param or entity id, unmount + remount the component
 *                 with the new key. Key-change handling is planned for a later release.
 *                 Two components mounting with the same key concurrently will race; last write
 *                 wins. For cross-tab coordination, see the `crossTab` option.
 * @param state    The form state to persist. Re-runs the write check whenever this changes.
 *                 Writes only fire when the persisted JSON actually differs from the last write —
 *                 parent re-renders with unchanged values are no-ops.
 * @param hydrate  Called once on mount if a valid draft is found (and again on cross-tab updates
 *                 when `crossTab` is enabled). Wire it to your form's setter.
 * @param options  See {@link UseFormDraftOptions}.
 */
export function useFormDraft<T>(
  key: string,
  state: T,
  hydrate: (draft: T) => void,
  options?: UseFormDraftOptions<T>,
): UseFormDraftReturn {
  const ttlDays = options?.ttlDays ?? 30;
  const disabled = options?.disabled ?? false;
  const hasFile = options?.hasFile ?? false;
  const skipRestore = options?.skipRestore ?? false;
  const version = options?.version ?? 1;
  const exclude = options?.exclude;
  const debounceMs = options?.debounceMs ?? 400;
  const crossTab = options?.crossTab ?? false;

  const storage = resolveStorage(options?.storage);

  const [restored, setRestored] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [hadFile, setHadFile] = useState(false);

  const hydrateRef = useRef(hydrate);
  useEffect(() => {
    hydrateRef.current = hydrate;
  });

  // Keep the resolved storage and read-time options reachable from event-listener
  // closures (the cross-tab effect) without re-subscribing on every render.
  const storageRef = useRef(storage);
  storageRef.current = storage;
  const readOptsRef = useRef({ ttlDays, version, exclude });
  readOptsRef.current = { ttlDays, version, exclude };

  // Seed once with the initial persistable JSON — so the very first effect run
  // (and StrictMode's double-mount) sees "no change vs initial" and writes nothing.
  // Also prevents writes on parent re-renders where `state` is a new reference
  // but its JSON is identical (e.g. RHF's form.watch() snapshot).
  // safeStringify returns null on non-serializable input; we leave the ref null
  // in that case and the write effect will also no-op (also returning null).
  const lastWrittenJsonRef = useRef<string | null>(null);
  if (lastWrittenJsonRef.current === null) {
    lastWrittenJsonRef.current = safeStringify(stripExcluded(state, exclude));
  }

  // Apply a freshly-read payload into hook state + the host form. Shared by the
  // mount-restore effect and the cross-tab listener.
  const applyDraft = useCallback((draft: DraftPayload<T>) => {
    hydrateRef.current(draft.state);
    setRestored(true);
    setSavedAt(new Date(draft.savedAt));
    setHadFile(draft.hadFile);
    // Seed lastWritten so the post-hydrate render doesn't re-persist what we just restored.
    lastWrittenJsonRef.current = safeStringify(
      stripExcluded(draft.state, readOptsRef.current.exclude),
    );
  }, []);

  // Restore on mount
  useEffect(() => {
    if (skipRestore) return;
    const draft = safeGet<T>(storage, key, ttlDays, version);
    if (!draft) return;
    try {
      applyDraft(draft);
    } catch {
      safeDel(storage, key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cross-tab sync: another tab saving (or clearing) this key fires a `storage`
  // event here. We re-read through safeGet so version/ttl validation still applies.
  useEffect(() => {
    if (!crossTab || typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      const { ttlDays: ttl, version: ver } = readOptsRef.current;
      if (e.newValue === null) {
        // Another tab cleared the draft. Don't clobber what the user is typing here;
        // just drop our restored badge so stale "restored N ago" UI goes away.
        setRestored(false);
        setSavedAt(null);
        setHadFile(false);
        return;
      }
      const draft = safeGet<T>(storageRef.current, key, ttl, ver);
      if (!draft) return;
      try {
        applyDraft(draft);
      } catch {
        safeDel(storageRef.current, key);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crossTab, key]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced write — only when the persistable JSON actually changes.
  useEffect(() => {
    if (disabled) return;
    const payload = stripExcluded(state, exclude);
    const json = safeStringify(payload);
    // Non-serializable payload (BigInt, circular ref, throwing toJSON): skip silently.
    // We never want a write to crash the form.
    if (json === null) return;
    if (json === lastWrittenJsonRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      safeSet(storage, key, payload, hasFile, version);
      lastWrittenJsonRef.current = json;
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, disabled]);

  const clear = useCallback(() => {
    safeDel(storageRef.current, key);
    setRestored(false);
    setSavedAt(null);
    setHadFile(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Re-seed on next render so a subsequent state reset (e.g. setForm(empty) on submit)
    // doesn't compare against a stale pre-clear payload and re-persist the reset state.
    lastWrittenJsonRef.current = null;
  }, [key]);

  return { restored, savedAt, hadFile, clear };
}
