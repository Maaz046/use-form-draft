import { useCallback, useEffect, useRef, useState } from 'react';

const hasWindow = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

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

function safeGet<T>(key: string, ttlDays: number, version: number): DraftPayload<T> | null {
  if (!hasWindow()) return null;
  try {
    const raw = window.localStorage.getItem(key);
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

function safeSet<T>(key: string, state: T, hadFile: boolean, version: number): void {
  if (!hasWindow()) return;
  try {
    const p: DraftPayload<T> = {
      version,
      savedAt: new Date().toISOString(),
      hadFile,
      state,
    };
    window.localStorage.setItem(key, JSON.stringify(p));
  } catch {
    /* quota exceeded / private browsing / disabled */
  }
}

function safeDel(key: string): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.removeItem(key);
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
 * Auto-saves form state to localStorage with a debounced write, and restores it on mount.
 *
 * @param key      Stable storage key. Pattern: `draft:<scope>:<qualifier>` (e.g. `draft:tender:create`).
 *                 Two components mounting with the same key concurrently will race; last write wins.
 *                 Cross-instance coordination is on the v0.1.1 roadmap.
 * @param state    The form state to persist. Re-runs the write check whenever this changes.
 *                 Writes only fire when the persisted JSON actually differs from the last write —
 *                 parent re-renders with unchanged values are no-ops.
 * @param hydrate  Called once on mount if a valid draft is found. Wire it to your form's setter.
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

  const [restored, setRestored] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [hadFile, setHadFile] = useState(false);

  const hydrateRef = useRef(hydrate);
  useEffect(() => {
    hydrateRef.current = hydrate;
  });

  // Seed once with the initial persistable JSON — so the very first effect run
  // (and StrictMode's double-mount) sees "no change vs initial" and writes nothing.
  // Also prevents writes on parent re-renders where `state` is a new reference
  // but its JSON is identical (e.g. RHF's form.watch() snapshot).
  const lastWrittenJsonRef = useRef<string | null>(null);
  if (lastWrittenJsonRef.current === null) {
    lastWrittenJsonRef.current = JSON.stringify(stripExcluded(state, exclude));
  }

  // Restore on mount
  useEffect(() => {
    if (skipRestore) return;
    const draft = safeGet<T>(key, ttlDays, version);
    if (!draft) return;
    try {
      hydrateRef.current(draft.state);
      setRestored(true);
      setSavedAt(new Date(draft.savedAt));
      setHadFile(draft.hadFile);
      // Seed lastWritten so the post-hydrate render doesn't re-persist what we just restored.
      lastWrittenJsonRef.current = JSON.stringify(stripExcluded(draft.state, exclude));
    } catch {
      safeDel(key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced write — only when the persistable JSON actually changes.
  useEffect(() => {
    if (disabled) return;
    const payload = stripExcluded(state, exclude);
    const json = JSON.stringify(payload);
    if (json === lastWrittenJsonRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      safeSet(key, payload, hasFile, version);
      lastWrittenJsonRef.current = json;
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, disabled]);

  const clear = useCallback(() => {
    safeDel(key);
    setRestored(false);
    setSavedAt(null);
    setHadFile(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [key]);

  return { restored, savedAt, hadFile, clear };
}
