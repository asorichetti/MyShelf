import { systemClock } from './clock';

/** Where cached bodies live. The app passes `apiCacheRepo.store(db)`; tests can pass a Map. */
export interface ResponseCacheStore {
  get(url: string): Promise<{ body: string; fetchedAt: string } | null>;
  put(url: string, body: string, fetchedAt: string): Promise<void>;
}

/** PLAN §6: successful JSON responses are kept for 30 days. */
export const DEFAULT_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface ResponseCache {
  /** The cached body if it is younger than `ttlMs`, else null. Storage errors count as a miss. */
  read(url: string, ttlMs: number): Promise<string | null>;
  /** Stores a body; storage errors are swallowed (the cache is an optimisation). */
  write(url: string, body: string): Promise<void>;
}

export function createResponseCache(store: ResponseCacheStore, clock: { now(): number } = systemClock): ResponseCache {
  return {
    async read(url, ttlMs) {
      try {
        const entry = await store.get(url);
        if (!entry) return null;
        const age = clock.now() - Date.parse(entry.fetchedAt);
        return Number.isFinite(age) && age >= 0 && age < ttlMs ? entry.body : null;
      } catch {
        return null;
      }
    },
    async write(url, body) {
      try {
        await store.put(url, body, new Date(clock.now()).toISOString());
      } catch {
        // A full or locked database must not fail the lookup.
      }
    },
  };
}

/** An in-memory store, for tests and for running without a database. */
export function memoryCacheStore(): ResponseCacheStore & { entries: Map<string, { body: string; fetchedAt: string }> } {
  const entries = new Map<string, { body: string; fetchedAt: string }>();
  return {
    entries,
    get: async (url) => entries.get(url) ?? null,
    put: async (url, body, fetchedAt) => void entries.set(url, { body, fetchedAt }),
  };
}
