import { jest } from '@jest/globals';
import express from 'express';
import supertest from 'supertest';
import {
  createMemoryRateLimitStore,
  createRateLimitStore,
  registerRateLimitStoreAdapter,
  clearRateLimitStoreAdapters,
} from '../services/rateLimit/store.js';
import { createRateLimiter, normalizeIdentity, normalizeIp, retryAfterSeconds } from '../middleware/rateLimit.js';
import { createAuthRateLimit, AUTH_RATE_LIMIT_MESSAGE } from '../middleware/authRateLimit.js';
import { createChatRateLimit, CHAT_RATE_LIMIT_MESSAGE } from '../middleware/chatRateLimit.js';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  clearRateLimitStoreAdapters();
});

/** Deterministic injected clock — no reliance on wall time. */
function fakeClock(start = 1_000_000) {
  let now = start;
  return { now: () => now, advance: (ms) => { now += ms; } };
}

describe('normalization', () => {
  test('normalizes IPv6-mapped IPv4', () => {
    expect(normalizeIp('::ffff:203.0.113.5')).toBe('203.0.113.5');
  });

  test('strips a port from an IPv4 address', () => {
    expect(normalizeIp('203.0.113.5:51234')).toBe('203.0.113.5');
  });

  test('handles bracketed IPv6 with a port', () => {
    expect(normalizeIp('[2001:db8::1]:443')).toBe('2001:db8::1');
  });

  test('preserves a bare IPv6 address', () => {
    expect(normalizeIp('2001:db8::1')).toBe('2001:db8::1');
  });

  test('maps unusable values to a single shared bucket', () => {
    expect(normalizeIp(undefined)).toBe('unknown');
    expect(normalizeIp('')).toBe('unknown');
  });

  test('case-folds and bounds identities', () => {
    expect(normalizeIdentity('  AdMiN ')).toBe('admin');
    expect(normalizeIdentity('x'.repeat(500))).toHaveLength(128);
    expect(normalizeIdentity(undefined)).toBe('');
  });

  test('Retry-After is at least one second', () => {
    expect(retryAfterSeconds(1000, 1000)).toBe(1);
    expect(retryAfterSeconds(4500, 1000)).toBe(4);
  });
});

describe('memory store', () => {
  test('counts within a window and resets after it expires', async () => {
    const clock = fakeClock();
    const store = createMemoryRateLimitStore({ clock: clock.now });

    expect(await store.increment('k', 1000)).toMatchObject({ count: 1 });
    expect(await store.increment('k', 1000)).toMatchObject({ count: 2 });

    clock.advance(1001);
    expect(await store.increment('k', 1000)).toMatchObject({ count: 1 });
  });

  test('separates distinct keys', async () => {
    const store = createMemoryRateLimitStore();
    await store.increment('a', 1000);
    expect(await store.increment('b', 1000)).toMatchObject({ count: 1 });
  });

  test('sweeps expired records instead of growing forever', async () => {
    const clock = fakeClock();
    const store = createMemoryRateLimitStore({ clock: clock.now });

    for (let i = 0; i < 50; i += 1) await store.increment(`k${i}`, 1000);
    expect(store.size()).toBe(50);

    clock.advance(2000);
    await store.increment('trigger', 1000);
    expect(store.size()).toBe(1);
  });

  test('bounds memory under key flooding', async () => {
    const store = createMemoryRateLimitStore({ maxKeys: 10 });
    for (let i = 0; i < 500; i += 1) await store.increment(`flood${i}`, 60000);
    expect(store.size()).toBeLessThanOrEqual(10);
  });
});

describe('store factory', () => {
  test('returns a memory store by default', async () => {
    const { store, degraded } = await createRateLimitStore({ storeName: 'memory' });
    expect(store.name).toBe('memory');
    expect(store.distributed).toBe(false);
    expect(degraded).toBe(false);
  });

  test('falls back to memory and flags degradation when an adapter is not registered', async () => {
    const { store, degraded, requested } = await createRateLimitStore({ storeName: 'redis' });
    expect(store.name).toBe('memory');
    expect(degraded).toBe(true);
    expect(requested).toBe('redis');
  });

  test('falls back safely when a registered adapter fails to initialize', async () => {
    registerRateLimitStoreAdapter('redis', async () => { throw new Error('ECONNREFUSED'); });
    const { store, degraded } = await createRateLimitStore({ storeName: 'redis' });
    expect(store.name).toBe('memory');
    expect(degraded).toBe(true);
  });

  test('uses a registered distributed adapter satisfying the store contract', async () => {
    const shared = new Map();
    registerRateLimitStoreAdapter('redis', async () => ({
      name: 'redis',
      distributed: true,
      async increment(key, windowMs) {
        const entry = shared.get(key) || { count: 0, resetAt: Date.now() + windowMs };
        entry.count += 1;
        shared.set(key, entry);
        return entry;
      },
      async reset() { shared.clear(); },
      async close() { shared.clear(); },
    }));

    const { store, degraded } = await createRateLimitStore({ storeName: 'redis' });
    expect(store.name).toBe('redis');
    expect(store.distributed).toBe(true);
    expect(degraded).toBe(false);
    expect(await store.increment('k', 1000)).toMatchObject({ count: 1 });
    expect(await store.increment('k', 1000)).toMatchObject({ count: 2 });
  });

  test('rejects an adapter that does not satisfy the contract', async () => {
    registerRateLimitStoreAdapter('redis', async () => ({ name: 'broken' }));
    const { store, degraded } = await createRateLimitStore({ storeName: 'redis' });
    expect(store.name).toBe('memory');
    expect(degraded).toBe(true);
  });
});

describe('limiter middleware', () => {
  const buildApp = (middleware) => {
    const app = express();
    app.use(express.json());
    app.post('/probe', middleware, (_req, res) => res.json({ ok: true }));
    return app;
  };

  test('allows requests below the limit and rejects once exceeded', async () => {
    const store = createMemoryRateLimitStore();
    const app = buildApp(createRateLimiter({
      store, windowMs: 60000, max: 2, keyGenerator: () => 'fixed', message: 'nope',
    }));

    await supertest(app).post('/probe').expect(200);
    await supertest(app).post('/probe').expect(200);
    const blocked = await supertest(app).post('/probe').expect(429);
    expect(blocked.body).toEqual({ message: 'nope' });
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  test('allows the request when the store fails rather than locking everyone out', async () => {
    const store = { name: 'broken', increment: async () => { throw new Error('down'); } };
    const app = buildApp(createRateLimiter({
      store, windowMs: 1000, max: 1, keyGenerator: () => 'k', message: 'nope',
    }));
    await supertest(app).post('/probe').expect(200);
    await supertest(app).post('/probe').expect(200);
  });

  test('skips counting when the key generator yields no bucket', async () => {
    const store = createMemoryRateLimitStore();
    const app = buildApp(createRateLimiter({
      store, windowMs: 1000, max: 1, keyGenerator: () => [], message: 'nope',
    }));
    await supertest(app).post('/probe').expect(200);
    await supertest(app).post('/probe').expect(200);
    expect(store.size()).toBe(0);
  });
});

describe('auth rate limiting', () => {
  const buildApp = (options) => {
    const app = express();
    app.use(express.json());
    app.post('/login', createAuthRateLimit(options), (_req, res) => res.status(401).json({ message: 'Invalid username or password' }));
    return app;
  };

  test('allows attempts below the limit', async () => {
    const store = createMemoryRateLimitStore();
    const app = buildApp({ store, maxAttempts: 3, maxPerIp: 50, windowMs: 60000 });
    for (let i = 0; i < 3; i += 1) {
      await supertest(app).post('/login').send({ username: 'admin', password: 'x' }).expect(401);
    }
  });

  test('returns a stable 429 with Retry-After once the identity limit is exceeded', async () => {
    const store = createMemoryRateLimitStore();
    const app = buildApp({ store, maxAttempts: 2, maxPerIp: 50, windowMs: 900000 });

    await supertest(app).post('/login').send({ username: 'admin', password: 'x' }).expect(401);
    await supertest(app).post('/login').send({ username: 'admin', password: 'x' }).expect(401);

    const blocked = await supertest(app).post('/login').send({ username: 'admin', password: 'x' }).expect(429);
    expect(blocked.body).toEqual({ message: AUTH_RATE_LIMIT_MESSAGE });
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  test('does not reveal whether an account exists', async () => {
    const store = createMemoryRateLimitStore();
    const app = buildApp({ store, maxAttempts: 1, maxPerIp: 50, windowMs: 900000 });

    await supertest(app).post('/login').send({ username: 'realuser', password: 'x' }).expect(401);
    const knownBlocked = await supertest(app).post('/login').send({ username: 'realuser', password: 'x' }).expect(429);

    await supertest(app).post('/login').send({ username: 'ghost', password: 'x' }).expect(401);
    const ghostBlocked = await supertest(app).post('/login').send({ username: 'ghost', password: 'x' }).expect(429);

    expect(knownBlocked.body).toEqual(ghostBlocked.body);
  });

  test('separates distinct identities from the same IP', async () => {
    const store = createMemoryRateLimitStore();
    const app = buildApp({ store, maxAttempts: 1, maxPerIp: 50, windowMs: 900000 });

    await supertest(app).post('/login').send({ username: 'alice', password: 'x' }).expect(401);
    await supertest(app).post('/login').send({ username: 'alice', password: 'x' }).expect(429);
    // A different identity still has its own allowance.
    await supertest(app).post('/login').send({ username: 'bob', password: 'x' }).expect(401);
  });

  test('enforces a shared-IP ceiling so rotating usernames cannot bypass the limit', async () => {
    const store = createMemoryRateLimitStore();
    const app = buildApp({ store, maxAttempts: 100, maxPerIp: 3, windowMs: 900000 });

    for (let i = 0; i < 3; i += 1) {
      await supertest(app).post('/login').send({ username: `user${i}`, password: 'x' }).expect(401);
    }
    // Fourth distinct username from the same source is still blocked.
    await supertest(app).post('/login').send({ username: 'user4', password: 'x' }).expect(429);
  });

  test('normalizes identity case so casing cannot multiply the allowance', async () => {
    const store = createMemoryRateLimitStore();
    const app = buildApp({ store, maxAttempts: 1, maxPerIp: 50, windowMs: 900000 });

    await supertest(app).post('/login').send({ username: 'Admin', password: 'x' }).expect(401);
    await supertest(app).post('/login').send({ username: 'ADMIN', password: 'x' }).expect(429);
  });

  test('counts an attempt with no username against the IP bucket only', async () => {
    const store = createMemoryRateLimitStore();
    const app = buildApp({ store, maxAttempts: 1, maxPerIp: 2, windowMs: 900000 });

    await supertest(app).post('/login').send({ password: 'x' }).expect(401);
    await supertest(app).post('/login').send({ password: 'x' }).expect(401);
    await supertest(app).post('/login').send({ password: 'x' }).expect(429);
  });

  test('resets after the window elapses', async () => {
    const clock = fakeClock();
    const store = createMemoryRateLimitStore({ clock: clock.now });
    const app = buildApp({ store, maxAttempts: 1, maxPerIp: 50, windowMs: 900000, clock: clock.now });

    await supertest(app).post('/login').send({ username: 'admin', password: 'x' }).expect(401);
    await supertest(app).post('/login').send({ username: 'admin', password: 'x' }).expect(429);

    clock.advance(900001);
    await supertest(app).post('/login').send({ username: 'admin', password: 'x' }).expect(401);
  });

  test('allows login attempts through when the store fails', async () => {
    const store = { name: 'broken', increment: async () => { throw new Error('down'); } };
    const app = buildApp({ store, maxAttempts: 1, maxPerIp: 1, windowMs: 1000 });
    await supertest(app).post('/login').send({ username: 'admin', password: 'x' }).expect(401);
    await supertest(app).post('/login').send({ username: 'admin', password: 'x' }).expect(401);
  });
});

describe('chat rate limiting', () => {
  const buildApp = (options, username = 'admin') => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = username ? { username } : undefined; next(); });
    app.post('/chat', createChatRateLimit(options), (_req, res) => res.json({ ok: true }));
    return app;
  };

  test('enforces the per-user limit and returns Retry-After', async () => {
    const store = createMemoryRateLimitStore();
    const app = buildApp({ store, maxRequests: 2, windowMs: 60000 });

    await supertest(app).post('/chat').expect(200);
    await supertest(app).post('/chat').expect(200);

    const blocked = await supertest(app).post('/chat').expect(429);
    expect(blocked.body).toEqual({ message: CHAT_RATE_LIMIT_MESSAGE });
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  test('isolates users from each other', async () => {
    const store = createMemoryRateLimitStore();
    const alice = buildApp({ store, maxRequests: 1, windowMs: 60000 }, 'alice');
    const bob = buildApp({ store, maxRequests: 1, windowMs: 60000 }, 'bob');

    await supertest(alice).post('/chat').expect(200);
    await supertest(alice).post('/chat').expect(429);
    await supertest(bob).post('/chat').expect(200);
  });

  test('resets after the window elapses', async () => {
    const clock = fakeClock();
    const store = createMemoryRateLimitStore({ clock: clock.now });
    const app = buildApp({ store, maxRequests: 1, windowMs: 60000, clock: clock.now });

    await supertest(app).post('/chat').expect(200);
    await supertest(app).post('/chat').expect(429);

    clock.advance(60001);
    await supertest(app).post('/chat').expect(200);
  });

  test('falls back to an IP bucket for an unauthenticated request', async () => {
    const store = createMemoryRateLimitStore();
    const app = buildApp({ store, maxRequests: 1, windowMs: 60000 }, null);

    await supertest(app).post('/chat').expect(200);
    await supertest(app).post('/chat').expect(429);
  });

  test('allows chat through when the store fails', async () => {
    const store = { name: 'broken', increment: async () => { throw new Error('down'); } };
    const app = buildApp({ store, maxRequests: 1, windowMs: 1000 });
    await supertest(app).post('/chat').expect(200);
    await supertest(app).post('/chat').expect(200);
  });

  test('shares one bucket across instances when a distributed store is configured', async () => {
    const shared = new Map();
    const distributed = {
      name: 'redis',
      distributed: true,
      async increment(key, windowMs) {
        const entry = shared.get(key) || { count: 0, resetAt: Date.now() + windowMs };
        entry.count += 1;
        shared.set(key, entry);
        return entry;
      },
    };

    // Two independent "instances" backed by the same store.
    const instanceA = buildApp({ store: distributed, maxRequests: 2, windowMs: 60000 });
    const instanceB = buildApp({ store: distributed, maxRequests: 2, windowMs: 60000 });

    await supertest(instanceA).post('/chat').expect(200);
    await supertest(instanceB).post('/chat').expect(200);
    // The third request is rejected even though each instance saw only two.
    await supertest(instanceB).post('/chat').expect(429);
  });
});
