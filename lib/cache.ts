/**
 * Client-side in-memory cache with TTL.
 * Prevents redundant Supabase RPC calls when users navigate
 * between category pages and return to previously-viewed categories.
 */

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const store = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 60_000; // 1 minute
const MAX_ENTRIES = 100;

/** Build a deterministic cache key from an object of params */
export function cacheKey(prefix: string, params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k] ?? ""}`)
    .join("&");
  return `${prefix}:${sorted}`;
}

/** Get a cached value if it exists and hasn't expired */
export function cacheGet<T>(key: string, ttlMs = DEFAULT_TTL_MS): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttlMs) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

/** Store a value in the cache */
export function cacheSet<T>(key: string, data: T): void {
  // Evict oldest entries if we hit the cap
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { data, timestamp: Date.now() });
}

/** Invalidate a specific key or all keys matching a prefix */
export function cacheInvalidate(keyOrPrefix: string): void {
  if (store.has(keyOrPrefix)) {
    store.delete(keyOrPrefix);
    return;
  }
  // Prefix match
  for (const k of store.keys()) {
    if (k.startsWith(keyOrPrefix)) store.delete(k);
  }
}
