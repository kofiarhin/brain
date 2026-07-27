import { getChatRateLimitConfig } from '../config/rateLimit.js';
import { getChatRateLimitStore, resetRateLimitStores } from '../services/rateLimit/index.js';
import { createRateLimiter, normalizeIdentity, normalizeIp } from './rateLimit.js';

/** Unchanged from the previous implementation so the client contract is preserved. */
export const CHAT_RATE_LIMIT_MESSAGE = 'AI question limit reached. Please retry shortly.';

/**
 * Authenticated chat is per-user. Requests that somehow reach here without an
 * authenticated identity fall back to the normalized client IP so the bucket is
 * still bounded.
 */
export function chatRateLimitKey(req) {
  const identity = normalizeIdentity(req.user?.username);
  if (identity) return `chat:user:${identity}`;
  return `chat:ip:${normalizeIp(req.ip || req.socket?.remoteAddress)}`;
}

export function createChatRateLimit(options = {}) {
  const config = getChatRateLimitConfig();
  return createRateLimiter({
    store: options.store || getChatRateLimitStore(),
    windowMs: options.windowMs ?? config.windowMs,
    max: options.maxRequests ?? config.maxRequests,
    keyGenerator: chatRateLimitKey,
    message: CHAT_RATE_LIMIT_MESSAGE,
    component: 'chat',
    clock: options.clock || (() => Date.now()),
  });
}

/**
 * Route-level middleware.
 *
 * The limiter is resolved per request rather than at module load so that tests
 * and startup can swap the underlying store without re-importing the route.
 */
export function chatRateLimit(req, res, next) {
  return createChatRateLimit()(req, res, next);
}

/**
 * Retained for backwards compatibility with existing tests and tooling that
 * imported this helper from the previous in-process implementation.
 */
export const resetChatRateLimits = () => { void resetRateLimitStores(); };
