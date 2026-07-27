import { Note } from '../models/Note.js';
import { getAiConfig } from '../config/ai.js';
import { createLogger } from './observability/logger.js';

const log = createLogger('vector-search');

export class VectorSearchError extends Error {
  constructor(message, { code = 'VECTOR_SEARCH_FAILED', retryable = false } = {}) {
    super(message);
    this.name = 'VectorSearchError';
    Object.assign(this, { code, retryable });
  }
}

/**
 * Atlas reports a missing/!ready vector index through several message shapes
 * depending on driver and cluster version. Matching on these lets the caller
 * degrade to keyword retrieval with an accurate reason instead of reporting a
 * generic query failure.
 */
const INDEX_MISSING_PATTERNS = [
  /index not found/i,
  /unknown search index/i,
  /no such index/i,
  /\$vectorSearch.*index.*does not exist/i,
  /search index .* not found/i,
];

export function classifyAtlasError(error) {
  const message = String(error?.message || '');
  if (INDEX_MISSING_PATTERNS.some((pattern) => pattern.test(message))) {
    return new VectorSearchError('Vector index unavailable', { code: 'VECTOR_INDEX_MISSING', retryable: false });
  }
  return new VectorSearchError('Vector search query failed', { code: 'VECTOR_QUERY_FAILED', retryable: true });
}

/**
 * Semantic note search over Atlas Vector Search.
 *
 * Correctness guards:
 *   - Only `ready` embeddings produced by the ACTIVE embedding model are searched.
 *     Mixing models or dimensions in one similarity query yields meaningless
 *     distances, so `embeddingModel` is a hard filter and `embeddingDimensions`
 *     is re-verified on every returned row.
 *   - The raw vector is never projected or returned.
 *   - `numCandidates` and `limit` are bounded by configuration.
 *   - `ownerFilter` is applied to the Atlas `filter` when supplied. Brain is
 *     currently single-user (one configured `AUTH_USERNAME`, no owner field on
 *     Note), so it is empty today; the parameter exists so multi-user support
 *     cannot be introduced without an explicit ownership decision at this call
 *     site. See docs/OPERATIONS.md.
 *   - Atlas errors are classified into typed, safe codes. The raw driver error
 *     never reaches a client.
 */
export async function semanticSearchNotes({
  queryEmbedding,
  limit,
  numCandidates,
  ownerFilter = {},
  model = Note,
} = {}) {
  const config = getAiConfig();

  if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    throw new VectorSearchError('Query embedding is required', { code: 'VECTOR_QUERY_INVALID' });
  }

  if (queryEmbedding.length !== config.embeddingDimensions) {
    log.warn('vector_dimension_mismatch', {
      scope: 'query', expected: config.embeddingDimensions, received: queryEmbedding.length,
    });
    throw new VectorSearchError('Query embedding dimension mismatch', { code: 'VECTOR_DIMENSION_MISMATCH' });
  }

  const boundedCandidates = Math.min(Math.max(numCandidates || config.candidates, 1), config.candidates);
  const boundedLimit = Math.min(Math.max(limit || config.results, 1), config.candidates);

  let rows;
  try {
    rows = await model.aggregate([
      {
        $vectorSearch: {
          index: config.vectorIndex,
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: boundedCandidates,
          limit: boundedLimit,
          filter: {
            embeddingStatus: 'ready',
            embeddingModel: config.embeddingModel,
            ...ownerFilter,
          },
        },
      },
      {
        // `embedding` is deliberately absent from this projection.
        $project: {
          content: 1,
          embeddingModel: 1,
          embeddingDimensions: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ]);
  } catch (error) {
    const classified = classifyAtlasError(error);
    log.warn('vector_search_failed', { code: classified.code });
    throw classified;
  }

  const results = (Array.isArray(rows) ? rows : [])
    // Defence in depth: the Atlas filter should already exclude these, but a
    // partially-migrated collection can still surface wrong-dimension vectors.
    .filter((row) => row?.embeddingDimensions === config.embeddingDimensions)
    .filter((row) => row?.embeddingModel === config.embeddingModel)
    .slice(0, boundedLimit)
    .map((row) => ({
      id: String(row._id),
      content: row.content,
      score: Number.isFinite(Number(row.score)) ? Number(row.score) : 0,
    }));

  log.info('vector_search_completed', {
    returned: rows?.length || 0, selected: results.length, limit: boundedLimit, candidates: boundedCandidates,
  });

  return results;
}
