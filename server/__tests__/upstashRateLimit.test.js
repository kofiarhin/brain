import { jest } from '@jest/globals';
import { createUpstashRateLimitStore } from '../services/rateLimit/upstash.js';

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

describe('Upstash rate-limit adapter', () => {
  test('requires REST credentials', () => {
    expect(() => createUpstashRateLimitStore({ url: '', token: '' }))
      .toThrow(expect.objectContaining({ code: 'UPSTASH_NOT_CONFIGURED' }));
  });

  test('uses an atomic Lua increment/expiry command and hashes the raw bucket key', async () => {
    const fetchImpl = jest.fn(async () => response({ result: [2, 4500] }));
    const store = createUpstashRateLimitStore({
      url: 'https://example.upstash.io/',
      token: 'test-token',
      fetchImpl,
    });

    const before = Date.now();
    await expect(store.increment('ip:203.0.113.5', 5000)).resolves.toEqual(expect.objectContaining({ count: 2 }));
    const after = Date.now();

    expect(store.name).toBe('upstash');
    expect(store.distributed).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://example.upstash.io');
    expect(options.headers.Authorization).toBe('Bearer test-token');
    expect(options.body).not.toContain('203.0.113.5');

    const command = JSON.parse(options.body);
    expect(command[0]).toBe('EVAL');
    expect(command[1]).toContain("redis.call('INCR'");
    expect(command[1]).toContain("redis.call('PEXPIRE'");
    expect(command[2]).toBe('1');
    expect(command[3]).toMatch(/^brain:rate-limit:[a-f0-9]{64}$/);
    expect(command[4]).toBe('5000');

    const result = await store.increment('identity:user@example.com', 5000);
    expect(result.resetAt).toBeGreaterThanOrEqual(before + 4500);
    expect(result.resetAt).toBeLessThanOrEqual(after + 5000);
  });

  test('classifies network, HTTP and malformed-response failures without exposing provider bodies', async () => {
    const cases = [
      [jest.fn(async () => { throw new Error('token leaked'); }), 'UPSTASH_NETWORK_ERROR'],
      [jest.fn(async () => response({ error: 'token leaked' }, 503)), 'UPSTASH_HTTP_ERROR'],
      [jest.fn(async () => response({ result: ['bad'] })), 'UPSTASH_INVALID_RESPONSE'],
    ];

    for (const [fetchImpl, code] of cases) {
      const store = createUpstashRateLimitStore({
        url: 'https://example.upstash.io', token: 'secret-token', fetchImpl,
      });
      await store.increment('raw-sensitive-key', 1000).catch((error) => {
        expect(error.code).toBe(code);
        expect(JSON.stringify(error)).not.toContain('secret-token');
        expect(error.message).not.toContain('token leaked');
      });
    }
  });
});
