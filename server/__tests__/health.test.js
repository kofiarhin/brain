import { jest } from '@jest/globals';
import supertest from 'supertest';

process.env.AUTH_USERNAME = 'admin';
process.env.AUTH_PASSWORD = 'password';
process.env.JWT_SECRET = 'health-test-secret-value';

const mongoose = (await import('mongoose')).default;

/**
 * `readyState` is a prototype getter on the real Connection. Defining an own
 * property on the instance lets these tests drive it without mocking the whole
 * mongoose module (which the Note model needs for `Schema`).
 */
// Starts disconnected: model registration below must not think a live
// connection exists, or mongoose tries to bind collections to a real database.
let mongoReadyState = 0;
Object.defineProperty(mongoose.connection, 'readyState', {
  get: () => mongoReadyState,
  configurable: true,
});

const { createApp } = await import('../app.js');
const { setRateLimitStore, resetRateLimitStores } = await import('../services/rateLimit/index.js');
const { setEmbeddingQueue, resetEmbeddingQueue } = await import('../services/queue/index.js');

const ORIGINAL_ENV = { ...process.env };
const app = createApp({ serveClient: false });

beforeEach(async () => {
  process.env = { ...ORIGINAL_ENV };
  mongoReadyState = 1;
  await resetRateLimitStores();
  await resetEmbeddingQueue();
});

afterAll(() => { process.env = ORIGINAL_ENV; });

describe('liveness', () => {
  test('returns the unchanged health contract', async () => {
    const response = await supertest(app).get('/api/health').expect(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  test('stays healthy when MongoDB is down', async () => {
    mongoReadyState = 0;
    await supertest(app).get('/api/health').expect(200);
  });

  test('stays healthy when NVIDIA is not configured', async () => {
    process.env.NVIDIA_API_KEY = '';
    await supertest(app).get('/api/health').expect(200);
  });

  test('is public', async () => {
    await supertest(app).get('/api/health').expect(200);
  });
});

describe('readiness', () => {
  test('reports every required component', async () => {
    const response = await supertest(app).get('/api/ready').expect(200);
    expect(response.body.components).toHaveProperty('application');
    expect(response.body.components).toHaveProperty('mongodb');
    expect(response.body.components).toHaveProperty('rateLimitStore');
    expect(response.body.components).toHaveProperty('embeddingQueue');
    expect(response.body.components).toHaveProperty('nvidia');
    expect(response.body.components).toHaveProperty('vectorSearch');
  });

  test('returns 503 when a required dependency is unavailable', async () => {
    mongoReadyState = 0;
    const response = await supertest(app).get('/api/ready').expect(503);
    expect(response.body.status).toBe('unavailable');
    expect(response.body.components.mongodb.ok).toBe(false);
    expect(response.body.components.mongodb.required).toBe(true);
  });

  test('an unconfigured optional AI dependency degrades but stays 200', async () => {
    process.env.NVIDIA_API_KEY = '';
    process.env.NVIDIA_AI_ENABLED = 'true';
    const response = await supertest(app).get('/api/ready').expect(200);
    expect(response.body.status).toBe('degraded');
    expect(response.body.components.nvidia.configured).toBe(false);
    expect(response.body.components.nvidia.required).toBe(false);
    expect(response.body.degradedReasons).toContain('nvidia_not_configured');
  });

  test('flags a non-distributed rate-limit store as a limitation', async () => {
    const response = await supertest(app).get('/api/ready').expect(200);
    expect(response.body.degradedReasons).toContain('rate_limit_store_not_distributed');
    expect(response.body.components.rateLimitStore.auth.distributed).toBe(false);
  });

  test('flags a non-durable embedding queue as a limitation', async () => {
    const response = await supertest(app).get('/api/ready').expect(200);
    expect(response.body.degradedReasons).toContain('embedding_queue_not_durable');
    expect(response.body.components.embeddingQueue.durable).toBe(false);
  });

  test('reports ok when every component is healthy and distributed', async () => {
    process.env.NVIDIA_API_KEY = 'configured-key';
    setRateLimitStore('auth', { name: 'redis', distributed: true, increment: async () => ({ count: 1, resetAt: 0 }) });
    setRateLimitStore('chat', { name: 'redis', distributed: true, increment: async () => ({ count: 1, resetAt: 0 }) });
    setEmbeddingQueue({ name: 'bullmq', durable: true, enqueue: async () => 'enqueued', size: () => 0, inFlight: () => 0 });

    const response = await supertest(app).get('/api/ready').expect(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.degradedReasons).toEqual([]);
  });

  test('surfaces a degraded rate-limit store fallback', async () => {
    setRateLimitStore('auth', { name: 'memory', distributed: false, increment: async () => ({ count: 1, resetAt: 0 }) }, { degraded: true, requested: 'redis' });
    const response = await supertest(app).get('/api/ready').expect(200);
    expect(response.body.degradedReasons).toContain('rate_limit_store_fallback');
    expect(response.body.components.rateLimitStore.auth.requested).toBe('redis');
  });

  test('never exposes credentials, connection strings, or provider errors', async () => {
    process.env.NVIDIA_API_KEY = 'nvapi-super-secret-value';
    process.env.MONGODB_URI = 'mongodb+srv://user:pw@cluster.example.net/brain';

    const response = await supertest(app).get('/api/ready').expect(200);
    const serialized = JSON.stringify(response.body);

    expect(serialized).not.toContain('nvapi-super-secret-value');
    expect(serialized).not.toContain('cluster.example.net');
    expect(serialized).not.toContain('mongodb+srv');
    expect(serialized).not.toContain('pw@');
    // Presence is reported without the value.
    expect(response.body.components.nvidia.configured).toBe(true);
  });

  test('does not claim the Atlas vector index has been verified', async () => {
    const response = await supertest(app).get('/api/ready').expect(200);
    expect(response.body.components.vectorSearch.verified).toBe(false);
  });

  test('performs no provider call', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('health check must not call the provider');
    });
    await supertest(app).get('/api/ready').expect(200);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
