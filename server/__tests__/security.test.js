import { jest } from '@jest/globals';
import supertest from 'supertest';

process.env.AUTH_USERNAME = 'admin';
process.env.AUTH_PASSWORD = 'password';
process.env.JWT_SECRET = 'test-secret-value';

const { createApp, isOriginAllowed, resolveTrustProxy } = await import('../app.js');
const { resetRateLimitStores } = await import('../services/rateLimit/index.js');

const ORIGINAL_ENV = { ...process.env };

beforeEach(async () => {
  process.env = { ...ORIGINAL_ENV };
  await resetRateLimitStores();
});

afterAll(() => { process.env = ORIGINAL_ENV; });

const build = (options = {}) => createApp({ serveClient: false, ...options });

describe('security headers', () => {
  test('sets the important Helmet headers', async () => {
    const response = await supertest(build()).get('/api/health').expect(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBeDefined();
    expect(response.headers['strict-transport-security']).toBeDefined();
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['referrer-policy']).toBeDefined();
  });

  test('does not advertise Express through X-Powered-By', async () => {
    const response = await supertest(build()).get('/api/health').expect(200);
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  test('allows disabling CSP for deployments that need inline scripts', async () => {
    process.env.SECURITY_CSP_ENABLED = 'false';
    const response = await supertest(build()).get('/api/health').expect(200);
    expect(response.headers['content-security-policy']).toBeUndefined();
  });

  test('permits cross-origin resource reads for the separately hosted frontend', async () => {
    const response = await supertest(build()).get('/api/health').expect(200);
    expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  test('attaches a correlation id to every response', async () => {
    const response = await supertest(build()).get('/api/health').expect(200);
    expect(response.headers['x-request-id']).toMatch(/^[A-Za-z0-9._-]+$/);
  });
});

describe('CORS', () => {
  test('allows an explicitly configured origin', async () => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com';
    expect(isOriginAllowed('https://app.example.com')).toBe(true);

    const response = await supertest(build())
      .get('/api/health').set('Origin', 'https://app.example.com').expect(200);
    expect(response.headers['access-control-allow-origin']).toBe('https://app.example.com');
  });

  test('supports a comma-separated list of several origins', async () => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://a.example.com, https://b.example.com';
    expect(isOriginAllowed('https://a.example.com')).toBe(true);
    expect(isOriginAllowed('https://b.example.com')).toBe(true);
    expect(isOriginAllowed('https://c.example.com')).toBe(false);
  });

  test('rejects an unlisted origin', async () => {
    process.env.CORS_STRICT_ORIGINS = 'true';
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com';

    expect(isOriginAllowed('https://evil.example.com')).toBe(false);
    const response = await supertest(build())
      .get('/api/health').set('Origin', 'https://evil.example.com').expect(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('strict mode disables the legacy wildcard preview patterns', async () => {
    expect(isOriginAllowed('https://brain-anything.vercel.app')).toBe(true);
    process.env.CORS_STRICT_ORIGINS = 'true';
    expect(isOriginAllowed('https://brain-anything.vercel.app')).toBe(false);
  });

  test('does not enable credentialed CORS', async () => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com';
    const response = await supertest(build())
      .get('/api/health').set('Origin', 'https://app.example.com').expect(200);
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });
});

describe('request body limits', () => {
  test('rejects a body over the configured limit with 413', async () => {
    process.env.REQUEST_BODY_LIMIT = '1kb';
    const response = await supertest(build())
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ username: 'a', password: 'x'.repeat(5000) }));

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ message: 'Request body too large' });
  });

  test('accepts a body within the limit', async () => {
    process.env.REQUEST_BODY_LIMIT = '1mb';
    await supertest(build())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password' })
      .expect(200);
  });

  test('rejects malformed JSON with 400 and no parser internals', async () => {
    const response = await supertest(build())
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"username": ');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Malformed JSON body' });
  });
});

describe('proxy trust', () => {
  test('resolves only documented values, never an arbitrary truthy string', () => {
    expect(resolveTrustProxy(undefined)).toBe(false);
    expect(resolveTrustProxy('')).toBe(false);
    expect(resolveTrustProxy('false')).toBe(false);
    expect(resolveTrustProxy('maybe')).toBe(false);
    expect(resolveTrustProxy('nonsense')).toBe(false);
    expect(resolveTrustProxy('true')).toBe(1);
    expect(resolveTrustProxy('1')).toBe(1);
    expect(resolveTrustProxy('2')).toBe(2);
  });

  test('ignores X-Forwarded-For when proxy trust is disabled', async () => {
    process.env.AUTH_RATE_LIMIT_MAX_PER_IP = '2';
    process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS = '100';
    const app = build({ trustProxy: false });

    // All three requests share one real socket address, so spoofed forwarded
    // addresses must NOT create separate buckets.
    await supertest(app).post('/api/auth/login').set('X-Forwarded-For', '1.1.1.1').send({ username: 'a', password: 'x' }).expect(401);
    await supertest(app).post('/api/auth/login').set('X-Forwarded-For', '2.2.2.2').send({ username: 'b', password: 'x' }).expect(401);
    await supertest(app).post('/api/auth/login').set('X-Forwarded-For', '3.3.3.3').send({ username: 'c', password: 'x' }).expect(429);
  });

  test('honours X-Forwarded-For when proxy trust is explicitly configured', async () => {
    process.env.AUTH_RATE_LIMIT_MAX_PER_IP = '1';
    process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS = '100';
    const app = build({ trustProxy: 1 });

    await supertest(app).post('/api/auth/login').set('X-Forwarded-For', '1.1.1.1').send({ username: 'a', password: 'x' }).expect(401);
    // Different forwarded client => different bucket => still allowed.
    await supertest(app).post('/api/auth/login').set('X-Forwarded-For', '2.2.2.2').send({ username: 'b', password: 'x' }).expect(401);
    // Same forwarded client as the first request => blocked.
    await supertest(app).post('/api/auth/login').set('X-Forwarded-For', '1.1.1.1').send({ username: 'a', password: 'x' }).expect(429);
  });
});

describe('error sanitization', () => {
  /** Minimal app exercising the real error handler on a throwing route. */
  const buildFailingApp = async (error) => {
    const express = (await import('express')).default;
    const { errorHandler } = await import('../middleware/error.js');
    const app = express();
    app.get('/boom', (_req, _res, next) => next(error));
    app.use(errorHandler);
    return app;
  };

  test('returns a generic message in production and never leaks internals', async () => {
    process.env.NODE_ENV = 'production';
    const app = await buildFailingApp(new Error('mongodb+srv://user:pw@cluster.example.net leaked'));

    const response = await supertest(app).get('/boom').expect(500);
    expect(response.body).toEqual({ message: 'Server error' });
    expect(JSON.stringify(response.body)).not.toContain('cluster.example.net');
    expect(JSON.stringify(response.body)).not.toContain('mongodb');
  });

  test('retains the detailed message outside production for diagnosability', async () => {
    process.env.NODE_ENV = 'development';
    const app = await buildFailingApp(new Error('specific dev detail'));
    const response = await supertest(app).get('/boom').expect(500);
    expect(response.body).toEqual({ message: 'specific dev detail' });
  });

  test('preserves the CastError and ValidationError contracts', async () => {
    const castError = Object.assign(new Error('cast failed'), { name: 'CastError' });
    const castResponse = await supertest(await buildFailingApp(castError)).get('/boom').expect(404);
    expect(castResponse.body).toEqual({ message: 'Not found' });

    const validationError = Object.assign(new Error('content is required'), { name: 'ValidationError' });
    const validationResponse = await supertest(await buildFailingApp(validationError)).get('/boom').expect(400);
    expect(validationResponse.body).toEqual({ message: 'content is required' });
  });

  test('preserves the existing not-found contract', async () => {
    const response = await supertest(build()).get('/api/not-a-route').expect(404);
    expect(response.body.message).toContain('Route not found');
  });
});

describe('authentication responses', () => {
  test('returns a consistent failure message for wrong credentials', async () => {
    const app = build();
    const wrongPassword = await supertest(app).post('/api/auth/login').send({ username: 'admin', password: 'nope' }).expect(401);
    const unknownUser = await supertest(app).post('/api/auth/login').send({ username: 'ghost', password: 'nope' }).expect(401);
    expect(wrongPassword.body).toEqual({ message: 'Invalid username or password' });
    expect(unknownUser.body).toEqual(wrongPassword.body);
  });

  test('does not return the password or secret in a successful login', async () => {
    const response = await supertest(build()).post('/api/auth/login').send({ username: 'admin', password: 'password' }).expect(200);
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('test-secret-value');
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('expiresAt');
  });

  test('rate limits repeated login attempts', async () => {
    process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS = '2';
    process.env.AUTH_RATE_LIMIT_MAX_PER_IP = '100';
    const app = build();

    await supertest(app).post('/api/auth/login').send({ username: 'admin', password: 'nope' }).expect(401);
    await supertest(app).post('/api/auth/login').send({ username: 'admin', password: 'nope' }).expect(401);
    const blocked = await supertest(app).post('/api/auth/login').send({ username: 'admin', password: 'nope' }).expect(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });
});
