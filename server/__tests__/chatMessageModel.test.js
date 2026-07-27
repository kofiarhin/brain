import { ChatMessage } from '../models/ChatMessage.js';

/**
 * These assertions run against the real Mongoose schema rather than the fake
 * model used by the controller tests. Mongoose strips unknown paths silently
 * under its default strict mode, so a controller test using a fake model cannot
 * detect a missing schema path — grounding metadata would be dropped only in
 * production. Documents are instantiated without a database connection.
 */
const build = (overrides = {}) => new ChatMessage({
  conversationId: '507f1f77bcf86cd799439011',
  role: 'assistant',
  content: 'answer',
  ...overrides,
});

test('persists vector grounding metadata', () => {
  const message = build({
    retrieval: {
      mode: 'vector-reranked',
      candidateCount: 20,
      selectedCount: 5,
      embeddingModel: 'nvidia/llama-nemotron-embed-1b-v2',
      rerankModel: 'nvidia/llama-nemotron-rerank-1b-v2',
      degraded: false,
      sources: [{ type: 'note', id: 'note-1', score: 0.87 }],
    },
  }).toObject();

  expect(message.retrieval.mode).toBe('vector-reranked');
  expect(message.retrieval.candidateCount).toBe(20);
  expect(message.retrieval.embeddingModel).toBe('nvidia/llama-nemotron-embed-1b-v2');
  expect(message.retrieval.degraded).toBe(false);
  expect(message.retrieval.sources).toHaveLength(1);
  expect(message.retrieval.sources[0]).toEqual(
    expect.objectContaining({ type: 'note', id: 'note-1', score: 0.87 }),
  );
});

test('persists degraded retrieval with its reason', () => {
  const message = build({
    retrieval: { mode: 'keyword-fallback', degraded: true, degradedReason: 'NVIDIA_RATE_LIMITED', sources: [] },
  }).toObject();

  expect(message.retrieval.mode).toBe('keyword-fallback');
  expect(message.retrieval.degraded).toBe(true);
  expect(message.retrieval.degradedReason).toBe('NVIDIA_RATE_LIMITED');
});

test('never stores a raw embedding vector alongside a source', () => {
  const message = build({
    retrieval: {
      mode: 'vector',
      sources: [{ type: 'note', id: 'note-1', score: 0.5, embedding: [0.1, 0.2, 0.3] }],
    },
  }).toObject();

  expect(message.retrieval.sources[0].embedding).toBeUndefined();
});

test('omits retrieval entirely when none was supplied', () => {
  expect(build().toObject().retrieval).toBeUndefined();
});
