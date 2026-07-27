import { envInteger } from './parse.js';

/** Shared upper bound on tracked keys per store, guarding against memory growth. */
export const rateLimitMaxKeys = () => envInteger('RATE_LIMIT_MAX_KEYS', { fallback: 10000, min: 100, max: 1000000 });

export function getAuthRateLimitConfig() {
  return {
    windowMs: envInteger('AUTH_RATE_LIMIT_WINDOW_MS', { fallback: 900000, min: 1000, max: 86400000 }),
    maxAttempts: envInteger('AUTH_RATE_LIMIT_MAX_ATTEMPTS', { fallback: 5, min: 1, max: 10000 }),
    /**
     * Per-IP ceiling. Deliberately higher than the per-identity limit so a shared
     * egress IP (office, mobile carrier NAT) is not trivially locked out, while a
     * single source still cannot spray guesses across many usernames.
     */
    maxPerIp: envInteger('AUTH_RATE_LIMIT_MAX_PER_IP', { fallback: 20, min: 1, max: 10000 }),
    storeName: process.env.AUTH_RATE_LIMIT_STORE || 'memory',
  };
}

export function getChatRateLimitConfig() {
  return {
    windowMs: envInteger('CHAT_RATE_LIMIT_WINDOW_MS', { fallback: 60000, min: 1000, max: 86400000 }),
    /**
     * Falls back to the pre-existing `AI_QUESTION_LIMIT_PER_MINUTE` so deployments
     * configured before this change keep their current behaviour.
     */
    maxRequests: envInteger('CHAT_RATE_LIMIT_MAX_REQUESTS', {
      fallback: envInteger('AI_QUESTION_LIMIT_PER_MINUTE', { fallback: 5, min: 1, max: 1000 }),
      min: 1,
      max: 10000,
    }),
    storeName: process.env.CHAT_RATE_LIMIT_STORE || 'memory',
  };
}
