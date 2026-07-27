import { boundedInteger, envBoolean, envInteger } from './parse.js';

/**
 * Upper bounds exist so a mis-set environment variable degrades to something
 * survivable instead of, for example, retrying a provider call 10,000 times or
 * requesting a multi-megabyte prompt budget.
 */
export const MAX_RETRIES_CEILING = 5;
export const DEFAULT_MAX_RETRIES = 2;

/**
 * `NVIDIA_MAX_RETRIES` semantics.
 *
 * The value counts *retries*, not attempts:
 *   0 -> exactly one attempt, no retries
 *   2 -> up to three attempts (one initial + two retries)
 *
 * Invalid input (decimal, negative, empty, non-numeric, oversized) falls back to
 * DEFAULT_MAX_RETRIES rather than producing NaN. A NaN here previously made the
 * retry loop body unreachable, so the request helper fell through and returned
 * `undefined`, which surfaced later as a misleading `NVIDIA_INVALID_EMBEDDING`.
 */
export function resolveMaxRetries(raw = process.env.NVIDIA_MAX_RETRIES) {
  return boundedInteger(raw, { fallback: DEFAULT_MAX_RETRIES, min: 0, max: MAX_RETRIES_CEILING });
}

export function getAiConfig() {
  return {
    enabled: envBoolean('NVIDIA_AI_ENABLED', true),
    vectorEnabled: envBoolean('NVIDIA_VECTOR_SEARCH_ENABLED', true),
    rerankEnabled: envBoolean('NVIDIA_RERANK_ENABLED', true),
    apiKey: process.env.NVIDIA_API_KEY || '',
    baseUrl: (process.env.NVIDIA_API_BASE_URL || 'https://integrate.api.nvidia.com').replace(/\/+$/, ''),
    chatModel: process.env.NVIDIA_CHAT_MODEL || 'meta/llama-3.1-70b-instruct',
    embeddingModel: process.env.NVIDIA_EMBEDDING_MODEL || 'nvidia/llama-3.2-nv-embedqa-1b-v2',
    rerankModel: process.env.NVIDIA_RERANK_MODEL || 'nvidia/llama-3.2-nv-rerankqa-1b-v2',
    embeddingDimensions: envInteger('NVIDIA_EMBEDDING_DIMENSIONS', { fallback: 2048, min: 1, max: 16384 }),
    vectorIndex: process.env.NVIDIA_VECTOR_INDEX || 'note_embedding_vector_index',
    timeoutMs: envInteger('NVIDIA_REQUEST_TIMEOUT_MS', { fallback: 30000, min: 1000, max: 120000 }),
    maxRetries: resolveMaxRetries(),
    questionLimit: envInteger('AI_QUESTION_LIMIT_PER_MINUTE', { fallback: 5, min: 1, max: 1000 }),
    candidates: envInteger('AI_VECTOR_CANDIDATES', { fallback: 20, min: 1, max: 200 }),
    results: envInteger('AI_RERANKED_RESULTS', { fallback: 5, min: 1, max: 50 }),
    maxContextChars: envInteger('AI_MAX_CONTEXT_CHARS', { fallback: 18000, min: 1000, max: 200000 }),
    maxAnswerTokens: envInteger('AI_MAX_ANSWER_TOKENS', { fallback: 700, min: 1, max: 8192 }),
  };
}
