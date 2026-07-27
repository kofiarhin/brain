import { jest } from '@jest/globals';

process.env.NVIDIA_API_KEY = 'nvapi-test-key';
process.env.NVIDIA_EMBEDDING_DIMENSIONS = '3';
process.env.NVIDIA_EMBEDDING_MODEL = 'test-embed-model';

const createEmbedding = jest.fn();
const rerankDocuments = jest.fn();
const generateChatCompletion = jest.fn();

jest.unstable_mockModule('../services/nvidiaClient.js', () => ({
  createEmbedding,
  rerankDocuments,
  generateChatCompletion,
  NvidiaProviderError: class extends Error {},
}));

const semanticSearchNotes = jest.fn();
jest.unstable_mockModule('../services/vectorSearch.js', () => ({ semanticSearchNotes }));

const create = jest.fn();
const findByIdAndDelete = jest.fn();
jest.unstable_mockModule('../models/Note.js', () => ({ Note: { create, findByIdAndDelete } }));

const connectDB = jest.fn();
jest.unstable_mockModule('../config/db.js', () => ({ connectDB, disconnectDB: jest.fn() }));

const {
  run,
  pollForVectorMatch,
  isPermanentVectorError,
  POLL_MAX_ATTEMPTS,
  POLL_INITIAL_DELAY_MS,
  POLL_MAX_DELAY_MS,
} = await import('../scripts/nvidiaSmokeTest.js');

const NOTE_ID = 'temporary-note-id';
const vector = [0.1, 0.2, 0.3];

/** Atlas classifies a transient query failure as retryable; configuration faults are not. */
const transientError = () => Object.assign(new Error('connection reset'), {
  code: 'VECTOR_QUERY_FAILED', retryable: true,
});
const permanentError = (code = 'VECTOR_INDEX_MISSING') => Object.assign(new Error('index not found'), {
  code, retryable: false,
});

const hit = (id = NOTE_ID) => ({ id, content: 'stored smoke text', score: 0.9 });

beforeEach(() => {
  semanticSearchNotes.mockReset();
  create.mockReset().mockResolvedValue({ _id: NOTE_ID });
  findByIdAndDelete.mockReset().mockResolvedValue({});
  connectDB.mockReset().mockResolvedValue({});
  createEmbedding.mockReset().mockResolvedValue({ embedding: vector, model: 'test-embed-model', dimensions: 3 });
  rerankDocuments.mockReset().mockResolvedValue([{ index: 0, score: 1 }]);
  generateChatCompletion.mockReset().mockResolvedValue('A walk with a dog.');
});

describe('pollForVectorMatch', () => {
  test('matches on the first attempt without sleeping', async () => {
    semanticSearchNotes.mockResolvedValue([hit()]);
    const sleep = jest.fn();

    const result = await pollForVectorMatch({ queryEmbedding: vector, noteId: NOTE_ID, sleep });

    expect(result).toMatchObject({ matched: true, attempts: 1, returned: 1, reason: 'matched' });
    expect(semanticSearchNotes).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  test('matches after the index catches up on a later attempt', async () => {
    semanticSearchNotes
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'someone-elses-note', content: 'other', score: 0.4 }])
      .mockResolvedValueOnce([hit()]);
    const sleep = jest.fn();

    const result = await pollForVectorMatch({ queryEmbedding: vector, noteId: NOTE_ID, sleep });

    expect(result).toMatchObject({ matched: true, attempts: 3, reason: 'matched' });
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([POLL_INITIAL_DELAY_MS, POLL_INITIAL_DELAY_MS * 2]);
  });

  test('retries transient query failures and still reports a later match', async () => {
    semanticSearchNotes
      .mockRejectedValueOnce(transientError())
      .mockRejectedValueOnce(transientError())
      .mockResolvedValueOnce([hit()]);

    const result = await pollForVectorMatch({
      queryEmbedding: vector, noteId: NOTE_ID, sleep: jest.fn(),
    });

    expect(result).toMatchObject({ matched: true, attempts: 3 });
  });

  test('exhausts the bounded attempt budget without a match', async () => {
    semanticSearchNotes.mockResolvedValue([]);
    const sleep = jest.fn();

    const result = await pollForVectorMatch({ queryEmbedding: vector, noteId: NOTE_ID, sleep });

    expect(result).toMatchObject({ matched: false, attempts: POLL_MAX_ATTEMPTS, reason: 'exhausted' });
    expect(semanticSearchNotes).toHaveBeenCalledTimes(POLL_MAX_ATTEMPTS);
    // One fewer sleep than attempts: the final attempt is not followed by a wait.
    expect(sleep).toHaveBeenCalledTimes(POLL_MAX_ATTEMPTS - 1);
  });

  test('backs off exponentially but never beyond the cap', async () => {
    semanticSearchNotes.mockResolvedValue([]);
    const sleep = jest.fn();

    await pollForVectorMatch({ queryEmbedding: vector, noteId: NOTE_ID, sleep });

    const delays = sleep.mock.calls.map(([ms]) => ms);
    expect(delays).toEqual([1000, 2000, 4000, 5000, 5000, 5000, 5000]);
    expect(Math.max(...delays)).toBeLessThanOrEqual(POLL_MAX_DELAY_MS);
    expect(delays.every((ms) => ms >= POLL_INITIAL_DELAY_MS)).toBe(true);
  });

  test('stops immediately on a permanent index or dimension error', async () => {
    for (const code of ['VECTOR_INDEX_MISSING', 'VECTOR_DIMENSION_MISMATCH', 'VECTOR_QUERY_INVALID']) {
      semanticSearchNotes.mockReset().mockRejectedValue(permanentError(code));
      const sleep = jest.fn();

      const result = await pollForVectorMatch({ queryEmbedding: vector, noteId: NOTE_ID, sleep });

      expect(result).toMatchObject({ matched: false, attempts: 1, reason: 'permanent_error', code });
      expect(semanticSearchNotes).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    }
  });

  test('treats an unclassified error as permanent rather than burning the budget', async () => {
    semanticSearchNotes.mockRejectedValue(new TypeError('boom'));

    const result = await pollForVectorMatch({
      queryEmbedding: vector, noteId: NOTE_ID, sleep: jest.fn(),
    });

    expect(result).toMatchObject({ matched: false, attempts: 1, reason: 'permanent_error' });
    expect(isPermanentVectorError(new TypeError('boom'))).toBe(true);
    expect(isPermanentVectorError(transientError())).toBe(false);
  });

  test('reports only safe metadata per attempt', async () => {
    semanticSearchNotes
      .mockRejectedValueOnce(transientError())
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([hit()]);
    const attempts = [];

    await pollForVectorMatch({
      queryEmbedding: vector, noteId: NOTE_ID, sleep: jest.fn(), onAttempt: (info) => attempts.push(info),
    });

    expect(attempts.map((a) => a.attempt)).toEqual([1, 2, 3]);
    expect(attempts.map((a) => a.matched)).toEqual([false, false, true]);
    expect(attempts.map((a) => a.returned)).toEqual([0, 0, 1]);
    attempts.forEach((info) => {
      expect(Object.keys(info).sort()).toEqual(
        expect.arrayContaining(['attempt', 'durationMs', 'matched', 'returned']),
      );
      // No content, embedding, query text or identifier leaves the poller.
      Object.keys(info).forEach((key) => {
        expect(['attempt', 'returned', 'matched', 'durationMs', 'code']).toContain(key);
      });
      expect(typeof info.durationMs).toBe('number');
    });
    expect(attempts[0].code).toBe('VECTOR_QUERY_FAILED');
  });

  test('honours an overridden attempt budget', async () => {
    semanticSearchNotes.mockResolvedValue([]);

    const result = await pollForVectorMatch({
      queryEmbedding: vector, noteId: NOTE_ID, sleep: jest.fn(), maxAttempts: 2,
    });

    expect(result).toMatchObject({ attempts: 2, reason: 'exhausted' });
    expect(semanticSearchNotes).toHaveBeenCalledTimes(2);
  });
});

describe('smoke test run with a polling retrieval stage', () => {
  const logs = [];
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    logs.length = 0;
    process.env.RUN_NVIDIA_SMOKE_TEST = 'true';
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/brain';
    process.env.SMOKE_TEST_MONGODB_URI = 'mongodb://localhost:27017/brain_smoke';
    logSpy = jest.spyOn(console, 'log').mockImplementation((line) => logs.push(String(line)));
    errorSpy = jest.spyOn(console, 'error').mockImplementation((line) => logs.push(String(line)));
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    process.env.MONGODB_URI = 'mongodb://localhost:27017/brain';
  });

  const stagesFrom = () => logs
    .map((line) => { try { return JSON.parse(line); } catch { return null; } })
    .filter((entry) => entry && entry.stage);

  test('passes and cleans up when the note is found after retries', async () => {
    semanticSearchNotes
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([hit()]);

    const code = await run({ sleep: jest.fn() });

    expect(code).toBe(0);
    const retrieval = stagesFrom().find((s) => s.stage === 'atlas_vector_retrieval');
    expect(retrieval).toMatchObject({ ok: true, attempts: 2, matchedTemporaryNote: true, reason: 'matched' });
    expect(stagesFrom().filter((s) => s.stage === 'atlas_vector_poll_attempt')).toHaveLength(2);
    expect(findByIdAndDelete).toHaveBeenCalledWith(NOTE_ID);
    expect(stagesFrom().find((s) => s.stage === 'cleanup')).toMatchObject({ ok: true });
  });

  test('fails and still cleans up when polling is exhausted without a match', async () => {
    semanticSearchNotes.mockResolvedValue([]);

    const code = await run({ sleep: jest.fn() });

    expect(code).toBe(1);
    expect(stagesFrom().find((s) => s.stage === 'atlas_vector_retrieval')).toMatchObject({
      ok: false, matchedTemporaryNote: false, reason: 'exhausted', attempts: POLL_MAX_ATTEMPTS,
    });
    expect(stagesFrom().find((s) => s.stage === 'atlas_vector_retrieval_hint')).toMatchObject({ ok: false });
    expect(findByIdAndDelete).toHaveBeenCalledWith(NOTE_ID);
    expect(stagesFrom().find((s) => s.stage === 'cleanup')).toMatchObject({ ok: true });
    // Downstream stages must not run on a failed retrieval.
    expect(rerankDocuments).not.toHaveBeenCalled();
    expect(generateChatCompletion).not.toHaveBeenCalled();
  });

  test('fails fast and cleans up on a permanent vector error', async () => {
    semanticSearchNotes.mockRejectedValue(permanentError());
    const sleep = jest.fn();

    const code = await run({ sleep });

    expect(code).toBe(1);
    expect(semanticSearchNotes).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(stagesFrom().find((s) => s.stage === 'atlas_vector_retrieval_hint')).toMatchObject({
      reason: 'permanent_error', code: 'VECTOR_INDEX_MISSING',
    });
    expect(findByIdAndDelete).toHaveBeenCalledWith(NOTE_ID);
  });

  test('cleans up when a later stage throws', async () => {
    semanticSearchNotes.mockResolvedValue([hit()]);
    rerankDocuments.mockRejectedValue(Object.assign(new Error('rerank down'), { code: 'NVIDIA_HTTP_ERROR' }));

    const code = await run({ sleep: jest.fn() });

    expect(code).toBe(1);
    expect(stagesFrom().find((s) => s.stage === 'failed')).toMatchObject({ code: 'NVIDIA_HTTP_ERROR' });
    expect(findByIdAndDelete).toHaveBeenCalledWith(NOTE_ID);
    expect(stagesFrom().find((s) => s.stage === 'cleanup')).toMatchObject({ ok: true });
  });

  test('names the failing operation and HTTP status without leaking the message', async () => {
    semanticSearchNotes.mockResolvedValue([hit()]);
    rerankDocuments.mockRejectedValue(Object.assign(new Error('secret-bearing provider body'), {
      code: 'NVIDIA_ENDPOINT_NOT_FOUND', status: 404, operation: 'rerank',
    }));

    const code = await run({ sleep: jest.fn() });

    expect(code).toBe(1);
    const failure = stagesFrom().find((s) => s.stage === 'failed');
    expect(failure).toMatchObject({ code: 'NVIDIA_ENDPOINT_NOT_FOUND', status: 404, operation: 'rerank' });
    // The provider message can echo request bodies and URIs; it must stay out.
    expect(logs.join('\n')).not.toContain('secret-bearing provider body');
  });

  test('omits status and operation when the error carries neither', async () => {
    semanticSearchNotes.mockResolvedValue([hit()]);
    rerankDocuments.mockRejectedValue(new TypeError('boom'));

    await run({ sleep: jest.fn() });

    const failure = stagesFrom().find((s) => s.stage === 'failed');
    expect(failure).toMatchObject({ code: 'TypeError' });
    expect(failure).not.toHaveProperty('status');
    expect(failure).not.toHaveProperty('operation');
  });

  test('reports the rerank host so a routing mistake is visible in the output', async () => {
    semanticSearchNotes.mockResolvedValue([hit()]);

    await run({ sleep: jest.fn() });

    expect(stagesFrom().find((s) => s.stage === 'configuration')).toMatchObject({
      rerankBaseUrl: 'https://ai.api.nvidia.com',
    });
  });

  test('reports a failed cleanup instead of hiding it', async () => {
    semanticSearchNotes.mockResolvedValue([]);
    findByIdAndDelete.mockRejectedValue(Object.assign(new Error('delete failed'), { code: 'MONGO_ERROR' }));

    const code = await run({ sleep: jest.fn() });

    expect(code).toBe(1);
    expect(stagesFrom().find((s) => s.stage === 'cleanup')).toMatchObject({
      ok: false, code: 'MONGO_ERROR', action: 'remove manually',
    });
  });

  test('polling output never contains note content, keys or connection strings', async () => {
    semanticSearchNotes.mockResolvedValue([]);

    await run({ sleep: jest.fn() });

    const output = logs.join('\n');
    expect(output).not.toContain('nvapi-test-key');
    expect(output).not.toContain('mongodb://');
    expect(output).not.toContain('canine companion');
    expect(output).not.toContain('stored smoke text');
    expect(output).not.toContain('dog outdoors stroll');
  });
});
