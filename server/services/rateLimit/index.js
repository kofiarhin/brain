/**
 * Process-wide rate-limit store registry.
 *
 * Stores start as bounded in-memory instances so `createApp()` stays synchronous
 * and tests need no async setup. A deployment that has provisioned shared
 * infrastructure calls `initializeRateLimitStores()` during startup to swap in a
 * distributed adapter; until then the memory stores remain in force and
 * readiness reports the limitation.
 */

import { getAuthRateLimitConfig, getChatRateLimitConfig, rateLimitMaxKeys } from '../../config/rateLimit.js';
import { createMemoryRateLimitStore, createRateLimitStore } from './store.js';
import { registerUpstashRateLimitStoreAdapter } from './upstash.js';

registerUpstashRateLimitStoreAdapter();

const state = {
  auth: { store: createMemoryRateLimitStore(), degraded: false, requested: 'memory' },
  chat: { store: createMemoryRateLimitStore(), degraded: false, requested: 'memory' },
};

export const getAuthRateLimitStore = () => state.auth.store;
export const getChatRateLimitStore = () => state.chat.store;

/** Safe snapshot for readiness reporting — contains no keys or identities. */
export function describeRateLimitStores() {
  return {
    auth: {
      requested: state.auth.requested,
      active: state.auth.store.name,
      distributed: Boolean(state.auth.store.distributed),
      degraded: state.auth.degraded,
    },
    chat: {
      requested: state.chat.requested,
      active: state.chat.store.name,
      distributed: Boolean(state.chat.store.distributed),
      degraded: state.chat.degraded,
    },
  };
}

/**
 * Resolve configured stores. Safe to call once at startup; never throws, because
 * a store misconfiguration must not prevent the process from booting.
 */
export async function initializeRateLimitStores() {
  const maxKeys = rateLimitMaxKeys();
  const auth = getAuthRateLimitConfig();
  const chat = getChatRateLimitConfig();
  const sharedOptions = {
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  };

  state.auth = await createRateLimitStore({ storeName: auth.storeName, maxKeys, ...sharedOptions });
  state.chat = await createRateLimitStore({ storeName: chat.storeName, maxKeys, ...sharedOptions });

  return describeRateLimitStores();
}

/** Test helper: restore fresh bounded memory stores. */
export async function resetRateLimitStores(options = {}) {
  await state.auth.store.close?.().catch?.(() => {});
  await state.chat.store.close?.().catch?.(() => {});
  state.auth = { store: createMemoryRateLimitStore(options), degraded: false, requested: 'memory' };
  state.chat = { store: createMemoryRateLimitStore(options), degraded: false, requested: 'memory' };
}

/** Test helper: install a specific store (e.g. a failing stub). */
export function setRateLimitStore(scope, store, { degraded = false, requested = store?.name || 'custom' } = {}) {
  state[scope] = { store, degraded, requested };
}
