import { jest } from '@jest/globals';
import {
  backoffDelay,
  createEmbedding,
  generateChatCompletion,
  NvidiaProviderError,
  parseRetryAfter,
  rerankDocuments,
} from '../services/nvidiaClient.js';
import { resolveMaxRetries, DEFAULT_MAX_RETRIES, MAX_RETRIES_CEILING } from '../config/ai.js';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.NVIDIA_AI_ENABLED = 'true';
  process.env.NVIDIA_API_KEY = 'secret-test-key';
  process.env.NVIDIA_EMBEDDING_DIMENSIONS = '3';
  process.env.NVIDIA_MAX_RETRIES = '0';
  process.env.NVIDIA_REQUEST_TIMEOUT_MS = '1000';
});

afterAll(() => { process.env = ORIGINAL_ENV; });

const response = (data, status = 200, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => headers[String(name).toLowerCase()] ?? null },
  json: async () => data,
});

const embeddingBody = (vector) => ({ data: [{ embedding: vector }] });

describe('configuration validation', () => {
  test('rejects every invalid NVIDIA_MAX_RETRIES form without producing NaN', () => {
    for (const raw of ['', '   ', 'abc', '-1', '1.5', 'NaN', 'Infinity', null, undefined]) {
      const resolved = resolveMaxRetries(raw);
      expect(Number.isInteger(resolved)).toBe(true);
      expect(Number.isNaN(resolved)).toBe(false);
      expect(resolved).toBeGreaterThanOrEqual(0);
    }
  });

  test('accepts a valid integer', () => {
    expect(resolveMaxRetries('3')).toBe(3);
  });

  test('treats zero as one attempt with no retries', () => {
    expect(resolveMaxRetries('0')).toBe(0);
  });

  test('defaults an invalid value', () => {
    expect(resolveMaxRetries('nope')).toBe(DEFAULT_MAX_RETRIES);
  });

  test('clamps an excessively large value to the ceiling', () => {
    expect(resolveMaxRetries('100000')).toBe(MAX_RETRIES_CEILING);
  });

  test('an invalid retry configuration still performs exactly one attempt and throws', async () => {
    process.env.NVIDIA_MAX_RETRIES = 'not-a-number';
    // A non-retryable status must not be retried even when the fallback allows retries.
    const fetchImpl = jest.fn(async () => response({ message: 'bad request' }, 400));
    await expect(createEmbedding({ input: 'hello', fetchImpl })).rejects.toBeInstanceOf(NvidiaProviderError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('throws a typed error when the provider is not configured', async () => {
    process.env.NVIDIA_API_KEY = '';
    const fetchImpl = jest.fn();
    await expect(createEmbedding({ input: 'hello', fetchImpl }))
      .rejects.toMatchObject({ code: 'NVIDIA_NOT_CONFIGURED' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('throws a typed error when the integration is disabled', async () => {
    process.env.NVIDIA_AI_ENABLED = 'false';
    await expect(createEmbedding({ input: 'hello', fetchImpl: jest.fn() }))
      .rejects.toMatchObject({ code: 'NVIDIA_NOT_CONFIGURED' });
  });
});

describe('request control flow', () => {
  test('every operation either returns a validated value or throws — never undefined', async () => {
    const cases = [
      () => createEmbedding({ input: 'x', fetchImpl: async () => response(embeddingBody([1, 2, 3])) }),
      () => createEmbedding({ input: 'x', fetchImpl: async () => response({}, 500) }),
      () => rerankDocuments({ query: 'q', documents: ['a'], topN: 1, fetchImpl: async () => response({ rankings: [{ index: 0, logit: 1 }] }) }),
      () => rerankDocuments({ query: 'q', documents: ['a'], topN: 1, fetchImpl: async () => response({ rankings: 'bad' }) }),
      () => generateChatCompletion({ messages: [], fetchImpl: async () => response({ choices: [{ message: { content: 'ok' } }] }) }),
      () => generateChatCompletion({ messages: [], fetchImpl: async () => response({ choices: [] }) }),
    ];

    for (const run of cases) {
      let returned;
      let threw = false;
      try { returned = await run(); } catch (error) {
        threw = true;
        expect(error).toBeInstanceOf(NvidiaProviderError);
        expect(typeof error.code).toBe('string');
      }
      if (!threw) expect(returned).toBeDefined();
    }
  });

  test('rejects a malformed (non-JSON) success body instead of returning undefined', async () => {
    const fetchImpl = async () => ({
      ok: true, status: 200, headers: { get: () => null }, json: async () => { throw new Error('not json'); },
    });
    await expect(createEmbedding({ input: 'x', fetchImpl }))
      .rejects.toMatchObject({ code: 'NVIDIA_MALFORMED_RESPONSE' });
  });
});

describe('retry policy', () => {
  test('retries a retryable 5xx and succeeds', async () => {
    process.env.NVIDIA_MAX_RETRIES = '2';
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(response({}, 503))
      .mockResolvedValueOnce(response(embeddingBody([1, 2, 3])));
    await expect(createEmbedding({ input: 'x', fetchImpl })).resolves.toMatchObject({ dimensions: 3 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('retries a 429 and reports the rate-limited code on exhaustion', async () => {
    process.env.NVIDIA_MAX_RETRIES = '1';
    const fetchImpl = jest.fn(async () => response({}, 429));
    await expect(createEmbedding({ input: 'x', fetchImpl }))
      .rejects.toMatchObject({ code: 'NVIDIA_RATE_LIMITED', retryable: true, status: 429 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('does not retry a non-retryable 4xx', async () => {
    process.env.NVIDIA_MAX_RETRIES = '3';
    for (const status of [400, 401, 403, 404, 422]) {
      const fetchImpl = jest.fn(async () => response({}, status));
      await expect(createEmbedding({ input: 'x', fetchImpl }))
        .rejects.toMatchObject({ code: 'NVIDIA_HTTP_ERROR', retryable: false, status });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  });

  test('retries a network failure then exhausts with a typed error', async () => {
    process.env.NVIDIA_MAX_RETRIES = '1';
    const fetchImpl = jest.fn(async () => { throw new Error('socket hang up'); });
    await expect(createEmbedding({ input: 'x', fetchImpl }))
      .rejects.toMatchObject({ code: 'NVIDIA_NETWORK_ERROR', retryable: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('classifies an aborted request as a timeout', async () => {
    process.env.NVIDIA_MAX_RETRIES = '0';
    const fetchImpl = async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    };
    await expect(createEmbedding({ input: 'x', fetchImpl }))
      .rejects.toMatchObject({ code: 'NVIDIA_TIMEOUT' });
  });

  test('passes an abort signal so timeouts are enforceable', async () => {
    const fetchImpl = jest.fn(async () => response(embeddingBody([1, 2, 3])));
    await createEmbedding({ input: 'x', fetchImpl });
    expect(fetchImpl.mock.calls[0][1].signal).toBeDefined();
  });

  test('honours Retry-After in seconds', () => {
    expect(parseRetryAfter('2')).toBe(2000);
  });

  test('honours Retry-After as an HTTP date', () => {
    const now = Date.now();
    expect(parseRetryAfter(new Date(now + 3000).toUTCString(), now)).toBeGreaterThan(1000);
  });

  test('caps a hostile Retry-After value', () => {
    expect(parseRetryAfter('99999')).toBeLessThanOrEqual(10000);
  });

  test('ignores an unparseable Retry-After', () => {
    expect(parseRetryAfter('soon')).toBeNull();
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter('')).toBeNull();
  });

  test('backoff is bounded and jittered', () => {
    expect(backoffDelay(0, () => 0)).toBe(0);
    expect(backoffDelay(10, () => 0.999)).toBeLessThanOrEqual(4000);
    expect(backoffDelay(1, () => 0.5)).toBeGreaterThanOrEqual(0);
  });
});

describe('embedding validation', () => {
  test('normalizes a valid embedding and sends the key only in the authorization header', async () => {
    const fetchImpl = jest.fn(async () => response(embeddingBody([0.1, 0.2, 0.3])));
    await expect(createEmbedding({ input: 'hello', fetchImpl }))
      .resolves.toEqual(expect.objectContaining({ embedding: [0.1, 0.2, 0.3], dimensions: 3 }));
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer secret-test-key');
    expect(fetchImpl.mock.calls[0][1].body).not.toContain('secret-test-key');
  });

  test('rejects a dimension mismatch with a distinct code', async () => {
    const fetchImpl = async () => response(embeddingBody([0.1, 0.2]));
    await expect(createEmbedding({ input: 'hello', fetchImpl }))
      .rejects.toMatchObject({ code: 'NVIDIA_EMBEDDING_DIMENSION_MISMATCH' });
  });

  test('rejects non-finite and empty vectors', async () => {
    await expect(createEmbedding({ input: 'x', fetchImpl: async () => response(embeddingBody([1, Number.NaN, 3])) }))
      .rejects.toMatchObject({ code: 'NVIDIA_INVALID_EMBEDDING' });
    await expect(createEmbedding({ input: 'x', fetchImpl: async () => response(embeddingBody([])) }))
      .rejects.toMatchObject({ code: 'NVIDIA_INVALID_EMBEDDING' });
    await expect(createEmbedding({ input: 'x', fetchImpl: async () => response({ data: [] }) }))
      .rejects.toMatchObject({ code: 'NVIDIA_INVALID_EMBEDDING' });
  });
});

describe('rerank validation', () => {
  test('returns bounded, ordered results for a valid response', async () => {
    const fetchImpl = async () => response({ rankings: [{ index: 1, logit: 9 }, { index: 0, logit: 4 }] });
    await expect(rerankDocuments({ query: 'q', documents: ['a', 'b'], topN: 2, fetchImpl }))
      .resolves.toEqual([{ index: 1, score: 9 }, { index: 0, score: 4 }]);
  });

  test('rejects out-of-range indexes', async () => {
    await expect(rerankDocuments({
      query: 'q', documents: ['a'], topN: 1,
      fetchImpl: async () => response({ rankings: [{ index: 4, logit: 1 }] }),
    })).rejects.toMatchObject({ code: 'NVIDIA_INVALID_RERANK' });
  });

  test('rejects duplicate indexes', async () => {
    await expect(rerankDocuments({
      query: 'q', documents: ['a', 'b'], topN: 2,
      fetchImpl: async () => response({ rankings: [{ index: 0, logit: 1 }, { index: 0, logit: 2 }] }),
    })).rejects.toMatchObject({ code: 'NVIDIA_INVALID_RERANK' });
  });

  test('rejects a non-array ranking payload', async () => {
    await expect(rerankDocuments({
      query: 'q', documents: ['a'], topN: 1,
      fetchImpl: async () => response({ rankings: 'nope' }),
    })).rejects.toMatchObject({ code: 'NVIDIA_INVALID_RERANK' });
  });
});

describe('chat validation', () => {
  test('returns trimmed content for a valid response', async () => {
    await expect(generateChatCompletion({
      messages: [{ role: 'user', content: 'hello' }],
      fetchImpl: async () => response({ choices: [{ message: { content: '  answer  ' } }] }),
    })).resolves.toBe('answer');
  });

  test('rejects empty, blank and non-string content', async () => {
    for (const body of [{ choices: [] }, { choices: [{ message: { content: '   ' } }] }, { choices: [{ message: { content: 42 } }] }]) {
      await expect(generateChatCompletion({ messages: [], fetchImpl: async () => response(body) }))
        .rejects.toMatchObject({ code: 'NVIDIA_EMPTY_RESPONSE' });
    }
  });
});

describe('privacy-safe diagnostics', () => {
  test('no thrown error message or field carries the API key', async () => {
    process.env.NVIDIA_MAX_RETRIES = '0';
    const fetchImpl = async () => response({ error: 'invalid key secret-test-key' }, 401);
    await createEmbedding({ input: 'x', fetchImpl }).catch((error) => {
      expect(JSON.stringify({ m: error.message, c: error.code, s: error.status })).not.toContain('secret-test-key');
    });
  });

  test('log output redacts secret-shaped values', async () => {
    const { redact } = await import('../services/observability/logger.js');
    const output = JSON.stringify(redact({
      apiKey: 'nvapi-abcdef1234567890',
      authorization: 'Bearer secret-test-key',
      note: 'a private note body',
      detail: 'connect mongodb+srv://user:pw@cluster.example.net/db',
      status: 429,
    }));
    expect(output).not.toContain('nvapi-abcdef1234567890');
    expect(output).not.toContain('secret-test-key');
    expect(output).not.toContain('a private note body');
    expect(output).not.toContain('cluster.example.net');
    expect(output).toContain('429');
  });
});
