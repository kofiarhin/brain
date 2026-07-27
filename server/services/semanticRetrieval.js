import { Note } from '../models/Note.js';
import { getAiConfig } from '../config/ai.js';
import { createEmbedding, rerankDocuments } from './nvidiaClient.js';
import { semanticSearchNotes } from './vectorSearch.js';
import { createLogger } from './observability/logger.js';

const log = createLogger('semantic-retrieval');

const words = (message) => [...new Set(String(message).toLowerCase().match(/[a-z0-9]{3,}/g) || [])].slice(0, 8);

/**
 * Keyword retrieval. This is the required fallback whenever semantic retrieval
 * is unavailable, and it is always reported as `degraded: true` so no caller can
 * mistake it for successful vector grounding.
 *
 * `ownerFilter` mirrors the vector path so both retrieval modes apply the same
 * scoping. It is empty in the current single-user design.
 */
export async function keywordFallback(message, { reason = 'UNKNOWN', ownerFilter = {}, model = Note } = {}) {
  const terms = words(message);
  const query = terms.length
    ? { ...ownerFilter, $or: terms.map((word) => ({ content: new RegExp(word, 'i') })) }
    : { ...ownerFilter };

  const notes = await model.find(query).sort({ updatedAt: -1 }).limit(10);

  log.info('retrieval_keyword_fallback', { reason, selected: notes.length });

  return {
    notes,
    retrieval: {
      mode: notes.length ? 'keyword-fallback' : 'none',
      candidateCount: notes.length,
      selectedCount: notes.length,
      embeddingModel: '',
      rerankModel: '',
      degraded: true,
      degradedReason: reason,
    },
  };
}

/**
 * Coordinate query embedding -> vector search -> optional rerank.
 *
 * Failure policy (matches the integration specification):
 *   query-embedding failure  -> keyword fallback, degraded
 *   vector index missing     -> keyword fallback, degraded
 *   Atlas query failure      -> keyword fallback, degraded
 *   rerank failure           -> keep vector order, NOT degraded
 *
 * `mode` is only ever `vector-reranked` when valid rerank output was applied.
 */
export async function retrieveRelevantNotes({ message, ownerFilter = {}, model = Note } = {}) {
  const config = getAiConfig();

  if (!config.vectorEnabled) {
    return keywordFallback(message, { reason: 'VECTOR_SEARCH_DISABLED', ownerFilter, model });
  }

  let embedding;
  try {
    ({ embedding } = await createEmbedding({ input: message, inputType: 'query' }));
  } catch (error) {
    return keywordFallback(message, { reason: error?.code || 'QUERY_EMBEDDING_FAILED', ownerFilter, model });
  }

  let candidates;
  try {
    candidates = await semanticSearchNotes({ queryEmbedding: embedding, ownerFilter, model });
  } catch (error) {
    return keywordFallback(message, { reason: error?.code || 'VECTOR_SEARCH_FAILED', ownerFilter, model });
  }

  if (!candidates.length) {
    // Vector search worked and legitimately found nothing. This is NOT degraded:
    // the pipeline is healthy, there is simply no matching evidence.
    return {
      notes: [],
      retrieval: {
        mode: 'none',
        candidateCount: 0,
        selectedCount: 0,
        embeddingModel: config.embeddingModel,
        rerankModel: '',
        degraded: false,
      },
    };
  }

  let selected = candidates.slice(0, config.results);
  let mode = 'vector';
  let rerankModel = '';

  if (config.rerankEnabled && candidates.length > 1) {
    try {
      const ranked = await rerankDocuments({
        query: message,
        documents: candidates.map((candidate) => candidate.content),
        topN: config.results,
      });
      // Preserve the ID mapping after the provider reorders results.
      selected = ranked
        .filter(({ index }) => candidates[index])
        .map(({ index, score }) => ({ ...candidates[index], score }));
      mode = 'vector-reranked';
      rerankModel = config.rerankModel;
    } catch (error) {
      // Reranking is an optimisation; vector order remains valid evidence.
      log.info('retrieval_rerank_fallback', { code: error?.code || 'RERANK_FAILED' });
    }
  }

  return {
    notes: selected,
    retrieval: {
      mode,
      candidateCount: candidates.length,
      selectedCount: selected.length,
      embeddingModel: config.embeddingModel,
      rerankModel,
      degraded: false,
    },
  };
}
