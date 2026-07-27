import { createLogger } from '../services/observability/logger.js';

const log = createLogger('rate-limit');

/**
 * Normalize a client IP so the same caller always maps to one bucket.
 *
 * Handles IPv6-mapped IPv4 (`::ffff:203.0.113.5`), bracketed IPv6 with a port,
 * `host:port` pairs, surrounding whitespace, and case. Returns `'unknown'` for
 * an unusable value so those requests still share a (single) bucket rather than
 * bypassing the limiter entirely.
 */
export function normalizeIp(raw) {
  if (!raw) return 'unknown';
  let value = String(raw).trim().toLowerCase();
  if (!value) return 'unknown';

  const bracketed = value.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) value = bracketed[1];

  // Strip a trailing port only for IPv4/hostname forms; bare IPv6 keeps its colons.
  if ((value.match(/:/g) || []).length === 1 && !value.includes('::')) value = value.split(':')[0];

  const mapped = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) value = mapped[1];

  return value || 'unknown';
}

/**
 * Normalize a login identity for bucketing.
 * Case-folded and length-capped; only ever used as a hash-like bucket key and
 * never logged in raw form.
 */
export function normalizeIdentity(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim().toLowerCase().slice(0, 128);
}

/** Seconds remaining until the window resets, floored at 1 per RFC 9110. */
export const retryAfterSeconds = (resetAt, now) => Math.max(1, Math.ceil((resetAt - now) / 1000));

/**
 * Build a rate-limiting middleware over a store.
 *
 * `keyGenerator` may return a single key or an array of keys. When it returns
 * several, every bucket is incremented and the request is rejected if ANY bucket
 * exceeds its limit. That is what lets the login limiter enforce a per-IP ceiling
 * and a per-identity ceiling at the same time.
 *
 * On store failure the request is allowed through and the event is logged: an
 * infrastructure fault must not lock every user out of the application.
 */
export function createRateLimiter({
  store,
  windowMs,
  max,
  keyGenerator,
  message,
  component = 'rate-limit',
  clock = () => Date.now(),
}) {
  return async function rateLimitMiddleware(req, res, next) {
    let keys;
    try {
      const generated = keyGenerator(req);
      keys = (Array.isArray(generated) ? generated : [generated]).filter(Boolean);
    } catch {
      return next();
    }

    // No applicable bucket for this request (e.g. a login attempt with no
    // username for the identity limiter) — nothing to count.
    if (keys.length === 0) return next();

    const now = clock();

    try {
      const results = await Promise.all(keys.map((key) => store.increment(key, windowMs)));
      const exceeded = results.find((result) => result.count > max);

      if (exceeded) {
        const seconds = retryAfterSeconds(exceeded.resetAt, now);
        res.set('Retry-After', String(seconds));
        log.warn('rate_limit_rejected', {
          component,
          // Bucket count only — never the raw IP or username.
          buckets: keys.length,
          limit: max,
          windowMs,
          retryAfterSeconds: seconds,
        });
        return res.status(429).json({ message });
      }

      return next();
    } catch (error) {
      log.error('rate_limit_store_error', { component, code: error?.code || 'UNKNOWN', decision: 'allow' });
      return next();
    }
  };
}
