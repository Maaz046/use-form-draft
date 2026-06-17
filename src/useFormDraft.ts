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

function stripExcluded<T>(state: T, exclude: ReadonlyArray<keyof T> | undefined): T {
  if (!exclude || exclude.length === 0) return state;
  if (state === null || typeof state !== 'object') return state;
  const copy = { ...(state as Record<string, unknown>) } as T;
  for (const key of exclude) {
    delete (copy as Record<string, unknown>)[key as string];
  }
  return copy;
}

/**
 * Auto-saves form state to localStorage with a debounced write, and restores it on mount.
 *
 * @param key      Stable storage key. Pattern: `draft:<scope>:<qualifier>` (e.g. `draft:tender:create`).
 * @param state    The form state to persist. Re-runs the debounced write whenever this changes.
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

  useEffect(() => {
    if (skipRestore) return;
    const draft = safeGet<T>(key, ttlDays, version);
    if (!draft) return;
    try {
      hydrateRef.current(draft.state);
      setRestored(true);
      setSavedAt(new Date(draft.savedAt));
      setHadFile(draft.hadFile);
    } catch {
      safeDel(key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (disabled) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const payload = stripExcluded(state, exclude);
      safeSet(key, payload, hasFile, version);
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
