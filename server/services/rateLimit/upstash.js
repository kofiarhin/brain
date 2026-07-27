import { createHash } from 'node:crypto';
import { registerRateLimitStoreAdapter } from './store.js';

const SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { count, ttl }
`;

const hashKey = (key) => createHash('sha256').update(String(key)).digest('hex');

function providerError(message, code, status = null) {
  const error = new Error(message);
  error.name = 'UpstashRateLimitError';
  error.code = code;
  error.status = status;
  return error;
}

export function createUpstashRateLimitStore({
  url = process.env.UPSTASH_REDIS_REST_URL,
  token = process.env.UPSTASH_REDIS_REST_TOKEN,
  fetchImpl = fetch,
  prefix = 'brain:rate-limit',
} = {}) {
  const baseUrl = String(url || '').replace(/\/+$/, '');
  const bearer = String(token || '');

  if (!baseUrl || !bearer) {
    throw providerError('Upstash Redis is not configured', 'UPSTASH_NOT_CONFIGURED');
  }

  return {
    name: 'upstash',
    distributed: true,

    async increment(key, windowMs) {
      const ttlMs = Math.max(1, Math.trunc(Number(windowMs) || 0));
      const redisKey = `${prefix}:${hashKey(key)}`;
      let response;

      try {
        response = await fetchImpl(baseUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${bearer}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(['EVAL', SCRIPT, '1', redisKey, String(ttlMs)]),
        });
      } catch {
        throw providerError('Upstash Redis request failed', 'UPSTASH_NETWORK_ERROR');
      }

      if (!response?.ok) {
        throw providerError('Upstash Redis request failed', 'UPSTASH_HTTP_ERROR', response?.status ?? null);
      }

      const payload = await response.json().catch(() => null);
      if (!payload || payload.error || !Array.isArray(payload.result) || payload.result.length < 2) {
        throw providerError('Invalid Upstash Redis response', 'UPSTASH_INVALID_RESPONSE', response.status);
      }

      const count = Number(payload.result[0]);
      const ttl = Number(payload.result[1]);
      if (!Number.isInteger(count) || count < 1 || !Number.isFinite(ttl) || ttl < 0) {
        throw providerError('Invalid Upstash Redis response', 'UPSTASH_INVALID_RESPONSE', response.status);
      }

      return { count, resetAt: Date.now() + ttl };
    },

    async reset() {},
    async close() {},
  };
}

export function registerUpstashRateLimitStoreAdapter() {
  registerRateLimitStoreAdapter('upstash', createUpstashRateLimitStore);
}
