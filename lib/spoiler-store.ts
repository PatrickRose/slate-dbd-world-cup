/**
 * The browser-side store behind spoiler mode.
 *
 * Kept separate from `lib/spoilers.ts` so that the filtering and the video list
 * stay plain functions over data. This half touches `localStorage` and is only
 * ever used from a client component.
 *
 * It's shaped for `useSyncExternalStore`, which is the primitive for rendering
 * browser-only state: the server (and the hydrating client) render
 * `serverSpoilerState`, then React re-renders with the stored value. The catch
 * is that `spoilerSnapshot` has to return the *same object* while storage is
 * unchanged, or React would re-render forever — hence the cache.
 */
import {
  SPOILERS_OFF,
  parseSpoilerState,
  serialiseSpoilerState,
  storageKey,
  type SpoilerState,
} from "./spoilers";

const listeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cached: SpoilerState = SPOILERS_OFF;

/**
 * Fallback for when storage can't be written (private browsing, hardened
 * settings): the preference lives in memory for the rest of the visit, so the
 * controls still work — they just don't survive a reload.
 */
let memoryRaw: string | null | undefined;

function readRaw(year: number): string | null {
  if (memoryRaw !== undefined) return memoryRaw;
  try {
    return window.localStorage.getItem(storageKey(year));
  } catch {
    return null;
  }
}

/** Current stored state, stable by reference until storage actually changes. */
export function spoilerSnapshot(year: number): SpoilerState {
  const raw = readRaw(year);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parseSpoilerState(raw);
  }
  return cached;
}

/** What the server rendered: spoiler mode off, every result on the page. */
export function serverSpoilerState(): SpoilerState {
  return SPOILERS_OFF;
}

export function subscribeToSpoilers(onChange: () => void): () => void {
  listeners.add(onChange);
  // `storage` fires in *other* tabs, so a second tab follows along.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function writeSpoilerState(year: number, state: SpoilerState): void {
  const raw = serialiseSpoilerState(state);
  try {
    window.localStorage.setItem(storageKey(year), raw);
  } catch {
    memoryRaw = raw;
  }
  // `storage` events don't fire in the tab that did the writing, so tell our own
  // subscribers directly.
  cachedRaw = null;
  listeners.forEach((listener) => listener());
}
