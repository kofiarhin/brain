import { getAuthRateLimitConfig } from '../config/rateLimit.js';
import { getAuthRateLimitStore } from '../services/rateLimit/index.js';
import { createRateLimiter, normalizeIdentity, normalizeIp } from './rateLimit.js';

/**
 * Uniform rejection text. It is identical for an unknown username, a wrong
 * password, and a throttled request, so the response never reveals whether an
 * account exists.
 */
export const AUTH_RATE_LIMIT_MESSAGE = 'Too many login attempts. Please try again later.';

/**
 * Two buckets are consumed per attempt:
 *
 *   ip:<addr>            — a ceiling on all attempts from one source, so a
 *                          successful login (or a rotation through usernames)
 *                          cannot be used for distributed identity guessing.
 *   id:<addr>|<identity> — the per-credential guess limit.
 *
 * The identity is included only alongside the IP. Keying on identity alone would
 * let any attacker lock a known user out from anywhere.
 */
export function authRateLimitKeys(req) {
  const ip = normalizeIp(req.ip || req.socket?.remoteAddress);
  const identity = normalizeIdentity(req.body?.username);
  const keys = [`auth:ip:${ip}`];
  if (identity) keys.push(`auth:id:${ip}|${identity}`);
  return keys;
}

export function createAuthRateLimit(options = {}) {
  const config = getAuthRateLimitConfig();
  const store = options.store || getAuthRateLimitStore();
  const clock = options.clock || (() => Date.now());
  const windowMs = options.windowMs ?? config.windowMs;
  const maxIdentity = options.maxAttempts ?? config.maxAttempts;
  const maxPerIp = options.maxPerIp ?? config.maxPerIp;

  const ipLimiter = createRateLimiter({
    store,
    windowMs,
    max: maxPerIp,
    keyGenerator: (req) => `auth:ip:${normalizeIp(req.ip || req.socket?.remoteAddress)}`,
    message: AUTH_RATE_LIMIT_MESSAGE,
    component: 'auth-ip',
    clock,
  });

  const identityLimiter = createRateLimiter({
    store,
    windowMs,
    max: maxIdentity,
    keyGenerator: (req) => {
      const identity = normalizeIdentity(req.body?.username);
      // No identity supplied: skip this bucket entirely. The per-IP limiter has
      // already counted the attempt, so the request is still bounded.
      if (!identity) return [];
      const ip = normalizeIp(req.ip || req.socket?.remoteAddress);
      return `auth:id:${ip}|${identity}`;
    },
    message: AUTH_RATE_LIMIT_MESSAGE,
    component: 'auth-identity',
    clock,
  });

  return function authRateLimit(req, res, next) {
    return ipLimiter(req, res, (error) => {
      if (error) return next(error);
      if (res.headersSent) return undefined;
      return identityLimiter(req, res, next);
    });
  };
}
