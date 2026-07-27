import { jest } from '@jest/globals';
import { createEmbedding, generateChatCompletion, NvidiaProviderError, rerankDocuments } from '../services/nvidiaClient.js';

beforeEach(() => {
  process.env.NVIDIA_API_KEY = 'secret-test-key';
  process.env.NVIDIA_EMBEDDING_DIMENSIONS = '3';
  process.env.NVIDIA_MAX_RETRIES = '0';
});

const response = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => data,
});

test('normalizes embeddings and sends the key only in the authorization header', async () => {
  const fetchImpl = jest.fn(async () => response({ data: [{ embedding: [0.1, 0.2, 0.3] }] }));
  await expect(createEmbedding({ input: 'hello', fetchImpl })).resolves.toEqual(expect.objectContaining({ embedding: [0.1, 0.2, 0.3], dimensions: 3 }));
  expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer secret-test-key');
  expect(fetchImpl.mock.calls[0][1].body).not.toContain('secret-test-key');
});

test('rejects malformed embeddings', async () => {
  const fetchImpl = async () => response({ data: [{ embedding: [0.1] }] });
  await expect(createEmbedding({ input: 'hello', fetchImpl })).rejects.toMatchObject({ code: 'NVIDIA_INVALID_EMBEDDING' });
});

test('normalizes chat and rejects empty responses', async () => {
  await expect(generateChatCompletion({
    messages: [{ role: 'user', content: 'hello' }],
    fetchImpl: async () => response({ choices: [{ message: { content: 'answer' } }] }),
  })).resolves.toBe('answer');
  await expect(generateChatCompletion({
    messages: [{ role: 'user', content: 'hello' }],
    fetchImpl: async () => response({ choices: [] }),
  })).rejects.toBeInstanceOf(NvidiaProviderError);
});

test('validates reranker indexes', async () => {
  await expect(rerankDocuments({
    query: 'q', documents: ['a'], topN: 1,
    fetchImpl: async () => response({ rankings: [{ index: 4, logit: 1 }] }),
  })).rejects.toMatchObject({ code: 'NVIDIA_INVALID_RERANK' });
});
