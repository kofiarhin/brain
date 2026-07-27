import { jest } from '@jest/globals';

process.env.NVIDIA_API_KEY = 'test-key';
process.env.NVIDIA_EMBEDDING_DIMENSIONS = '3';
process.env.NVIDIA_EMBEDDING_MODEL = 'test-embed-model';
process.env.NVIDIA_RERANK_MODEL = 'test-rerank-model';
process.env.AI_RERANKED_RESULTS = '2';
process.env.AI_VECTOR_CANDIDATES = '5';

const createEmbedding = jest.fn();
const rerankDocuments = jest.fn();

jest.unstable_mockModule('../services/nvidiaClient.js', () => ({
  createEmbedding,
  rerankDocuments,
  generateChatCompletion: jest.fn(),
  NvidiaProviderError: class extends Error {},
}));

const aggregate = jest.fn();
const find = jest.fn();
jest.unstable_mockModule('../models/Note.js', () => ({ Note: { aggregate, find } }));

const { semanticSearchNotes, classifyAtlasError, VectorSearchError } = await import('../services/vectorSearch.js');
const { retrieveRelevantNotes, keywordFallback } = await import('../services/semanticRetrieval.js');

const vector = [0.1, 0.2, 0.3];

const row = (id, content, overrides = {}) => ({
  _id: id,
  content,
  embeddingModel: 'test-embed-model',
  embeddingDimensions: 3,
  score: 0.9,
  ...overrides,
});

const findChain = (records) => ({ sort: () => ({ limit: async () => records }) });

beforeEach(() => {
  aggregate.mockReset();
  find.mockReset();
  createEmbedding.mockReset().mockResolvedValue({ embedding: vector, model: 'test-embed-model', dimensions: 3 });
  rerankDocuments.mockReset();
  find.mockReturnValue(findChain([]));
});

describe('semanticSearchNotes', () => {
  test('returns mapped results for a successful query', async () => {
    aggregate.mockResolvedValue([row('a', 'first'), row('b', 'second')]);
    const results = await semanticSearchNotes({ queryEmbedding: vector });
    expect(results).toEqual([
      { id: 'a', content: 'first', score: 0.9 },
      { id: 'b', content: 'second', score: 0.9 },
    ]);
  });

  test('never returns the raw vector to callers', async () => {
    aggregate.mockResolvedValue([row('a', 'first', { embedding: vector })]);
    const results = await semanticSearchNotes({ queryEmbedding: vector });
    expect(results[0]).not.toHaveProperty('embedding');

    const projection = aggregate.mock.calls[0][0][1].$project;
    expect(projection.embedding).toBeUndefined();
  });

  test('filters to ready embeddings from the active model', async () => {
    aggregate.mockResolvedValue([]);
    await semanticSearchNotes({ queryEmbedding: vector });
    const filter = aggregate.mock.calls[0][0][0].$vectorSearch.filter;
    expect(filter.embeddingStatus).toBe('ready');
    expect(filter.embeddingModel).toBe('test-embed-model');
  });

  test('excludes rows whose stored dimensions do not match configuration', async () => {
    aggregate.mockResolvedValue([
      row('good', 'keep'),
      row('bad', 'drop', { embeddingDimensions: 1536 }),
    ]);
    const results = await semanticSearchNotes({ queryEmbedding: vector });
    expect(results.map((r) => r.id)).toEqual(['good']);
  });

  test('excludes rows produced by a different embedding model', async () => {
    aggregate.mockResolvedValue([
      row('good', 'keep'),
      row('bad', 'drop', { embeddingModel: 'legacy-model' }),
    ]);
    const results = await semanticSearchNotes({ queryEmbedding: vector });
    expect(results.map((r) => r.id)).toEqual(['good']);
  });

  test('rejects a query embedding of the wrong dimension', async () => {
    await expect(semanticSearchNotes({ queryEmbedding: [1, 2] }))
      .rejects.toMatchObject({ code: 'VECTOR_DIMENSION_MISMATCH' });
    expect(aggregate).not.toHaveBeenCalled();
  });

  test('rejects a missing query embedding', async () => {
    await expect(semanticSearchNotes({ queryEmbedding: [] }))
      .rejects.toMatchObject({ code: 'VECTOR_QUERY_INVALID' });
  });

  test('bounds the requested result count', async () => {
    aggregate.mockResolvedValue([]);
    await semanticSearchNotes({ queryEmbedding: vector, limit: 9999, numCandidates: 9999 });
    const stage = aggregate.mock.calls[0][0][0].$vectorSearch;
    expect(stage.limit).toBeLessThanOrEqual(5);
    expect(stage.numCandidates).toBeLessThanOrEqual(5);
  });

  test('truncates an over-long provider result set', async () => {
    process.env.AI_RERANKED_RESULTS = '2';
    aggregate.mockResolvedValue([row('a', '1'), row('b', '2'), row('c', '3'), row('d', '4')]);
    const results = await semanticSearchNotes({ queryEmbedding: vector, limit: 2 });
    expect(results).toHaveLength(2);
  });

  test('classifies a missing index distinctly from a general failure', () => {
    expect(classifyAtlasError(new Error('PlanExecutor error: index not found'))).toMatchObject({ code: 'VECTOR_INDEX_MISSING' });
    expect(classifyAtlasError(new Error('Unknown search index "notes"'))).toMatchObject({ code: 'VECTOR_INDEX_MISSING' });
    expect(classifyAtlasError(new Error('connection reset'))).toMatchObject({ code: 'VECTOR_QUERY_FAILED' });
  });

  test('surfaces a typed error, never the raw Atlas error, on index failure', async () => {
    aggregate.mockRejectedValue(new Error('index not found for $vectorSearch on db.notes'));
    await expect(semanticSearchNotes({ queryEmbedding: vector }))
      .rejects.toMatchObject({ code: 'VECTOR_INDEX_MISSING' });

    const error = await semanticSearchNotes({ queryEmbedding: vector }).catch((e) => e);
    expect(error).toBeInstanceOf(VectorSearchError);
    expect(error.message).not.toContain('db.notes');
  });

  test('applies an ownership filter when one is supplied', async () => {
    aggregate.mockResolvedValue([]);
    await semanticSearchNotes({ queryEmbedding: vector, ownerFilter: { owner: 'alice' } });
    expect(aggregate.mock.calls[0][0][0].$vectorSearch.filter.owner).toBe('alice');
  });
});

describe('retrieval fallback behaviour', () => {
  test('reports vector mode when retrieval succeeds', async () => {
    process.env.NVIDIA_RERANK_ENABLED = 'false';
    aggregate.mockResolvedValue([row('a', 'first')]);
    const result = await retrieveRelevantNotes({ message: 'question' });
    expect(result.retrieval.mode).toBe('vector');
    expect(result.retrieval.degraded).toBe(false);
  });

  test('falls back to keyword retrieval when the index is missing', async () => {
    process.env.NVIDIA_RERANK_ENABLED = 'false';
    aggregate.mockRejectedValue(new Error('index not found'));
    find.mockReturnValue(findChain([{ _id: 'k1', content: 'keyword hit' }]));

    const result = await retrieveRelevantNotes({ message: 'question about work' });
    expect(result.retrieval.mode).toBe('keyword-fallback');
    expect(result.retrieval.degraded).toBe(true);
    expect(result.retrieval.degradedReason).toBe('VECTOR_INDEX_MISSING');
  });

  test('falls back to keyword retrieval when the Atlas query fails', async () => {
    process.env.NVIDIA_RERANK_ENABLED = 'false';
    aggregate.mockRejectedValue(new Error('connection reset'));
    find.mockReturnValue(findChain([{ _id: 'k1', content: 'keyword hit' }]));

    const result = await retrieveRelevantNotes({ message: 'question about work' });
    expect(result.retrieval.mode).toBe('keyword-fallback');
    expect(result.retrieval.degraded).toBe(true);
  });

  test('falls back to keyword retrieval when the query embedding fails', async () => {
    createEmbedding.mockRejectedValue(Object.assign(new Error('down'), { code: 'NVIDIA_TIMEOUT' }));
    find.mockReturnValue(findChain([{ _id: 'k1', content: 'keyword hit' }]));

    const result = await retrieveRelevantNotes({ message: 'question about work' });
    expect(result.retrieval.mode).toBe('keyword-fallback');
    expect(result.retrieval.degradedReason).toBe('NVIDIA_TIMEOUT');
    expect(aggregate).not.toHaveBeenCalled();
  });

  test('never labels a keyword fallback as successful vector retrieval', async () => {
    aggregate.mockRejectedValue(new Error('index not found'));
    find.mockReturnValue(findChain([{ _id: 'k1', content: 'hit' }]));

    const result = await retrieveRelevantNotes({ message: 'work' });
    expect(result.retrieval.mode).not.toBe('vector');
    expect(result.retrieval.mode).not.toBe('vector-reranked');
    expect(result.retrieval.embeddingModel).toBe('');
  });

  test('empty vector results are reported as none, not degraded', async () => {
    process.env.NVIDIA_RERANK_ENABLED = 'false';
    aggregate.mockResolvedValue([]);
    const result = await retrieveRelevantNotes({ message: 'question' });
    expect(result.retrieval.mode).toBe('none');
    expect(result.retrieval.degraded).toBe(false);
    expect(result.notes).toEqual([]);
  });

  test('a brand new brain with no notes returns a safe empty result', async () => {
    aggregate.mockRejectedValue(new Error('index not found'));
    find.mockReturnValue(findChain([]));
    const result = await retrieveRelevantNotes({ message: 'anything' });
    expect(result.notes).toEqual([]);
    expect(result.retrieval.mode).toBe('none');
  });

  test('keeps vector order when reranking fails', async () => {
    process.env.NVIDIA_RERANK_ENABLED = 'true';
    aggregate.mockResolvedValue([row('a', 'first'), row('b', 'second')]);
    rerankDocuments.mockRejectedValue(Object.assign(new Error('rerank down'), { code: 'NVIDIA_HTTP_ERROR' }));

    const result = await retrieveRelevantNotes({ message: 'question' });
    expect(result.retrieval.mode).toBe('vector');
    expect(result.retrieval.rerankModel).toBe('');
    expect(result.notes.map((n) => n.id)).toEqual(['a', 'b']);
  });

  test('marks vector-reranked only when valid rerank output was applied', async () => {
    process.env.NVIDIA_RERANK_ENABLED = 'true';
    aggregate.mockResolvedValue([row('a', 'first'), row('b', 'second')]);
    rerankDocuments.mockResolvedValue([{ index: 1, score: 9 }, { index: 0, score: 3 }]);

    const result = await retrieveRelevantNotes({ message: 'question' });
    expect(result.retrieval.mode).toBe('vector-reranked');
    expect(result.retrieval.rerankModel).toBe('test-rerank-model');
    // ID mapping survives the reorder.
    expect(result.notes.map((n) => n.id)).toEqual(['b', 'a']);
  });

  test('bounds the number of notes handed to chat', async () => {
    process.env.AI_RERANKED_RESULTS = '2';
    process.env.NVIDIA_RERANK_ENABLED = 'false';
    aggregate.mockResolvedValue([row('a', '1'), row('b', '2'), row('c', '3')]);

    const result = await retrieveRelevantNotes({ message: 'question' });
    expect(result.notes.length).toBeLessThanOrEqual(2);
  });

  test('uses keyword retrieval when vector search is disabled', async () => {
    process.env.NVIDIA_VECTOR_SEARCH_ENABLED = 'false';
    find.mockReturnValue(findChain([{ _id: 'k1', content: 'hit' }]));

    const result = await retrieveRelevantNotes({ message: 'work' });
    expect(result.retrieval.degradedReason).toBe('VECTOR_SEARCH_DISABLED');
    expect(createEmbedding).not.toHaveBeenCalled();
  });
});

describe('retrieval scoping', () => {
  test('the keyword path applies the same ownership filter as the vector path', async () => {
    find.mockReturnValue(findChain([]));
    await keywordFallback('some question', { ownerFilter: { owner: 'alice' } });
    expect(find.mock.calls[0][0].owner).toBe('alice');
  });

  test('an ownership filter is preserved even with no keyword terms', async () => {
    find.mockReturnValue(findChain([]));
    await keywordFallback('', { ownerFilter: { owner: 'alice' } });
    expect(find.mock.calls[0][0]).toEqual({ owner: 'alice' });
  });

  test('an ownership filter reaches Atlas on the vector path', async () => {
    process.env.NVIDIA_VECTOR_SEARCH_ENABLED = 'true';
    process.env.NVIDIA_RERANK_ENABLED = 'false';
    aggregate.mockResolvedValue([]);
    await retrieveRelevantNotes({ message: 'question', ownerFilter: { owner: 'alice' } });
    expect(aggregate.mock.calls[0][0][0].$vectorSearch.filter.owner).toBe('alice');
  });
});
