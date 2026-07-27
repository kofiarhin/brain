/**
 * Rate-limit store abstraction.
 *
 * A store is any object satisfying:
 *
 *   increment(key, windowMs) -> Promise<{ count, resetAt }>
 *   reset()                  -> Promise<void>   // test/maintenance helper
 *   close()                  -> Promise<void>
 *   readonly name: string
 *   readonly distributed: boolean
 *
 * Two implementations ship here:
 *
 *   - `memory`: bounded, in-process. Correct for local development, tests, and
 *     single-process deployments ONLY. It cannot enforce a shared limit across
 *     multiple Heroku dynos or application instances, and it resets on restart.
 *
 *   - a registration boundary for a shared/distributed store (Redis or
 *     equivalent). No such infrastructure exists in this repository today, so no
 *     client dependency is added and no provider is assumed. A deployment that
 *     provisions one calls `registerRateLimitStoreAdapter()` during startup.
 *
 * Failure policy: if a configured shared store cannot initialise, the factory
 * falls back to the bounded memory store and marks the result `degraded`. This
 * keeps authentication and chat available (fail-open on infrastructure, not on
 * the limit itself) while readiness reporting surfaces the degradation. The
 * alternative — refusing all traffic when Redis is down — is a worse outage.
 */

import { createLogger } from '../observability/logger.js';

const log = createLogger('rate-limit-store');

/** Registered non-memory adapters, keyed by `RATE_LIMIT_STORE` value. */
const adapters = new Map();

/**
 * Register a shared-store adapter factory.
 * @param {string} name  value matched against the configured store name
 * @param {(options: object) => object} factory returns a store; may be async
 */
export function registerRateLimitStoreAdapter(name, factory) {
  adapters.set(String(name).toLowerCase(), factory);
}

/** Test helper: drop all registered adapters. */
export function clearRateLimitStoreAdapters() {
  adapters.clear();
}

export const DEFAULT_MAX_KEYS = 10000;

/**
 * Bounded in-process fixed-window store.
 *
 * Memory is bounded two ways: expired records are swept on every write, and if
 * the map is still at capacity the entry closest to expiry is evicted. Eviction
 * is a deliberate availability trade-off — under key-space flooding an attacker
 * can cause their own counter to be dropped, which is why this adapter is not
 * suitable as the sole protection for a multi-instance production deployment.
 */
export function createMemoryRateLimitStore({ maxKeys = DEFAULT_MAX_KEYS, clock = () => Date.now() } = {}) {
  const buckets = new Map();

  const sweep = (now) => {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  };

  const evictNearestExpiry = () => {
    let oldestKey = null;
    let oldestResetAt = Infinity;
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt < oldestResetAt) {
        oldestResetAt = bucket.resetAt;
        oldestKey = key;
      }
    }
    if (oldestKey !== null) buckets.delete(oldestKey);
  };

  return {
    name: 'memory',
    distributed: false,

    async increment(key, windowMs) {
      const now = clock();
      sweep(now);

      const existing = buckets.get(key);
      if (existing && existing.resetAt > now) {
        existing.count += 1;
        return { count: existing.count, resetAt: existing.resetAt };
      }

      if (!buckets.has(key) && buckets.size >= maxKeys) evictNearestExpiry();

      const bucket = { count: 1, resetAt: now + windowMs };
      buckets.set(key, bucket);
      return { count: bucket.count, resetAt: bucket.resetAt };
    },

    async reset() { buckets.clear(); },
    async close() { buckets.clear(); },

    /** Diagnostics only — never exposed to clients. */
    size() { return buckets.size; },
  };
}

/**
 * Build the configured store.
 *
 * @returns {Promise<{ store: object, degraded: boolean, requested: string }>}
 */
export async function createRateLimitStore({ storeName = 'memory', maxKeys = DEFAULT_MAX_KEYS, clock, ...options } = {}) {
  const requested = String(storeName || 'memory').toLowerCase();

  if (requested === 'memory') {
    return { store: createMemoryRateLimitStore({ maxKeys, clock }), degraded: false, requested };
  }

  const factory = adapters.get(requested);
  if (!factory) {
    log.error('rate_limit_store_unavailable', {
      requested, reason: 'ADAPTER_NOT_REGISTERED', fallback: 'memory',
    });
    return { store: createMemoryRateLimitStore({ maxKeys, clock }), degraded: true, requested };
  }

  try {
    const store = await factory({ maxKeys, clock, ...options });
    if (!store || typeof store.increment !== 'function') throw new Error('Adapter returned an invalid store');
    log.info('rate_limit_store_ready', { requested, distributed: Boolean(store.distributed) });
    return { store, degraded: false, requested };
  } catch (error) {
    log.error('rate_limit_store_unavailable', {
      requested, reason: 'ADAPTER_INIT_FAILED', code: error?.code || 'UNKNOWN', fallback: 'memory',
    });
    return { store: createMemoryRateLimitStore({ maxKeys, clock }), degraded: true, requested };
  }
}
