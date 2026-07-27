import { getAiConfig } from '../config/ai.js';
import { createLogger } from './observability/logger.js';

const log = createLogger('nvidia-client');

/** Transient HTTP statuses that justify a retry. */
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

const BACKOFF_BASE_MS = 250;
const BACKOFF_CEILING_MS = 4000;
/** Bound on server-supplied Retry-After so a hostile header cannot stall a request. */
const RETRY_AFTER_CEILING_MS = 10000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class NvidiaProviderError extends Error {
  constructor(message, { code = 'NVIDIA_PROVIDER_ERROR', retryable = false, status = null, operation = '' } = {}) {
    super(message);
    this.name = 'NvidiaProviderError';
    Object.assign(this, { code, retryable, status, operation });
  }
}

/**
 * Capped exponential backoff with full jitter.
 * Jitter prevents a fleet of retries from synchronising into a thundering herd.
 */
export function backoffDelay(attempt, random = Math.random) {
  const ceiling = Math.min(BACKOFF_BASE_MS * (2 ** attempt), BACKOFF_CEILING_MS);
  return Math.floor(random() * ceiling);
}

/**
 * Parse a `Retry-After` header. Supports both delta-seconds and HTTP-date forms.
 * Returns null when absent or unparseable so the caller uses jittered backoff.
 */
export function parseRetryAfter(headerValue, now = Date.now()) {
  if (headerValue === null || headerValue === undefined || headerValue === '') return null;

  const text = String(headerValue).trim();
  if (/^\d+$/.test(text)) return Math.min(Number(text) * 1000, RETRY_AFTER_CEILING_MS);

  const asDate = Date.parse(text);
  if (Number.isNaN(asDate)) return null;
  return Math.min(Math.max(asDate - now, 0), RETRY_AFTER_CEILING_MS);
}

const readHeader = (response, name) => {
  try {
    return response?.headers?.get?.(name) ?? null;
  } catch {
    return null;
  }
};

/**
 * Classify a failed response by status so the caller — and the smoke test —
 * can tell a wrong URL or a retired model apart from a generic provider fault.
 * A retired model answers 410 on its own route; an unknown route answers 404.
 */
export function errorCodeForStatus(status) {
  if (status === 429) return 'NVIDIA_RATE_LIMITED';
  if (status === 404) return 'NVIDIA_ENDPOINT_NOT_FOUND';
  if (status === 410) return 'NVIDIA_MODEL_RETIRED';
  return 'NVIDIA_HTTP_ERROR';
}

/**
 * Perform one POST against the NVIDIA API with bounded retries.
 *
 * `baseUrl` overrides the default host: reranking is served by a different host
 * from chat and embeddings.
 *
 * Control-flow guarantee: this function either returns a parsed provider payload
 * or throws an `NvidiaProviderError`. Every loop exit is explicit and the final
 * `throw` after the loop is unreachable-by-construction but retained so no code
 * path can fall through to `undefined` regardless of configuration.
 */
async function request(path, body, operation, fetchImpl = fetch, baseUrl = null) {
  const config = getAiConfig();
  const origin = baseUrl || config.baseUrl;

  if (!config.enabled || !config.apiKey) {
    throw new NvidiaProviderError('NVIDIA AI is not configured', { code: 'NVIDIA_NOT_CONFIGURED', operation });
  }

  const maxRetries = config.maxRetries;
  const totalAttempts = maxRetries + 1;
  const startedAt = Date.now();
  let lastError = null;

  log.debug('nvidia_request_started', { operation, attempts: totalAttempts });

  for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
    const isFinalAttempt = attempt === totalAttempts - 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetchImpl(`${origin}${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.ok) {
        const data = await response.json().catch(() => null);
        if (data === null || typeof data !== 'object') {
          throw new NvidiaProviderError('Malformed NVIDIA response body', {
            code: 'NVIDIA_MALFORMED_RESPONSE', status: response.status, operation,
          });
        }
        log.info('nvidia_request_completed', {
          operation, status: response.status, retries: attempt, durationMs: Date.now() - startedAt,
        });
        return data;
      }

      const retryable = RETRYABLE_STATUSES.has(response.status);
      const error = new NvidiaProviderError('NVIDIA request failed', {
        code: errorCodeForStatus(response.status),
        retryable,
        status: response.status,
        operation,
      });

      // Authentication, validation, unsupported-model and content-policy failures
      // are permanent; retrying only burns quota.
      if (!retryable || isFinalAttempt) throw error;

      lastError = error;
      const retryAfter = parseRetryAfter(readHeader(response, 'retry-after'));
      const delay = retryAfter === null ? backoffDelay(attempt) : retryAfter;
      log.warn('nvidia_request_retry', {
        operation, status: response.status, attempt, delayMs: delay, reason: error.code,
      });
      await sleep(delay);
      continue;
    } catch (caught) {
      if (caught instanceof NvidiaProviderError) {
        if (!caught.retryable || isFinalAttempt) {
          log.warn('nvidia_request_failed', {
            operation, code: caught.code, status: caught.status, retries: attempt,
            durationMs: Date.now() - startedAt,
          });
          throw caught;
        }
        lastError = caught;
        await sleep(backoffDelay(attempt));
        continue;
      }

      const timedOut = caught?.name === 'AbortError';
      const error = new NvidiaProviderError(timedOut ? 'NVIDIA request timed out' : 'NVIDIA request failed', {
        code: timedOut ? 'NVIDIA_TIMEOUT' : 'NVIDIA_NETWORK_ERROR',
        retryable: true,
        operation,
      });

      if (isFinalAttempt) {
        log.warn('nvidia_request_failed', {
          operation, code: error.code, retries: attempt, durationMs: Date.now() - startedAt,
        });
        throw error;
      }

      lastError = error;
      log.warn('nvidia_request_retry', { operation, attempt, reason: error.code });
      await sleep(backoffDelay(attempt));
      continue;
    } finally {
      clearTimeout(timeout);
    }
  }

  /* istanbul ignore next -- defensive: the loop above always returns or throws. */
  throw lastError || new NvidiaProviderError('NVIDIA request exhausted retries', {
    code: 'NVIDIA_RETRIES_EXHAUSTED', retryable: true, operation,
  });
}

export async function createEmbedding({ input, inputType = 'passage', fetchImpl } = {}) {
  const config = getAiConfig();
  const data = await request('/v1/embeddings', {
    model: config.embeddingModel,
    input: [String(input || '')],
    input_type: inputType,
    encoding_format: 'float',
  }, 'embedding', fetchImpl);

  const embedding = data?.data?.[0]?.embedding;

  if (!Array.isArray(embedding) || embedding.length === 0 || embedding.some((value) => !Number.isFinite(value))) {
    throw new NvidiaProviderError('Invalid NVIDIA embedding response', {
      code: 'NVIDIA_INVALID_EMBEDDING', operation: 'embedding',
    });
  }

  if (embedding.length !== config.embeddingDimensions) {
    log.warn('nvidia_embedding_dimension_mismatch', {
      operation: 'embedding', expected: config.embeddingDimensions, received: embedding.length,
    });
    throw new NvidiaProviderError('NVIDIA embedding dimension mismatch', {
      code: 'NVIDIA_EMBEDDING_DIMENSION_MISMATCH', operation: 'embedding',
    });
  }

  return { embedding, model: config.embeddingModel, dimensions: embedding.length };
}

/**
 * Build the reranking route for a model.
 *
 * The retrieval host gives every reranking model its own path and encodes dots in
 * the model name as underscores:
 *
 *   nvidia/llama-nemotron-rerank-1b-v2   -> /v1/retrieval/nvidia/llama-nemotron-rerank-1b-v2/reranking
 *   nvidia/llama-3.2-nv-rerankqa-1b-v2   -> /v1/retrieval/nvidia/llama-3_2-nv-rerankqa-1b-v2/reranking
 *
 * The dotted form is a different, non-existent route (404), so the substitution is
 * required rather than cosmetic. Segments are URL-encoded because the model name
 * comes from the environment and lands in a request path.
 */
export function rerankingPath(model) {
  const [vendor, name, ...rest] = String(model || '').split('/');

  if (!vendor || !name || rest.length > 0) {
    throw new NvidiaProviderError('Invalid NVIDIA rerank model', {
      code: 'NVIDIA_RERANK_MODEL_INVALID', operation: 'rerank',
    });
  }

  const slug = encodeURIComponent(name.replace(/\./g, '_'));
  return `/v1/retrieval/${encodeURIComponent(vendor)}/${slug}/reranking`;
}

export async function rerankDocuments({ query, documents, topN, fetchImpl } = {}) {
  const config = getAiConfig();
  const sources = Array.isArray(documents) ? documents : [];
  const limit = topN || config.results;

  // The reranking API rejects unknown fields, `top_n` among them: it always ranks
  // every passage. The caller-visible limit is applied to the response below.
  const data = await request(rerankingPath(config.rerankModel), {
    model: config.rerankModel,
    query: { text: String(query || '') },
    passages: sources.map((text) => ({ text: String(text || '') })),
  }, 'rerank', fetchImpl, config.rerankBaseUrl);

  const rows = data?.rankings || data?.results;
  if (!Array.isArray(rows)) {
    throw new NvidiaProviderError('Invalid NVIDIA rerank response', {
      code: 'NVIDIA_INVALID_RERANK', operation: 'rerank',
    });
  }

  const seen = new Set();
  return rows.map((row) => {
    const index = Number(row?.index);
    if (!Number.isInteger(index) || index < 0 || index >= sources.length || seen.has(index)) {
      throw new NvidiaProviderError('Invalid NVIDIA rerank response', {
        code: 'NVIDIA_INVALID_RERANK', operation: 'rerank',
      });
    }
    seen.add(index);
    const score = Number(row?.logit ?? row?.score ?? 0);
    return { index, score: Number.isFinite(score) ? score : 0 };
  }).slice(0, limit);
}

export async function generateChatCompletion({ messages, maxTokens, fetchImpl } = {}) {
  const config = getAiConfig();
  const data = await request('/v1/chat/completions', {
    model: config.chatModel,
    messages,
    max_tokens: maxTokens || config.maxAnswerTokens,
    temperature: 0.2,
  }, 'chat', fetchImpl);

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new NvidiaProviderError('Empty NVIDIA response', {
      code: 'NVIDIA_EMPTY_RESPONSE', operation: 'chat',
    });
  }

  return content.trim();
}
