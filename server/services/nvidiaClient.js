import { getAiConfig } from '../config/ai.js';

const TRANSIENT = new Set([429, 502, 503, 504]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class NvidiaProviderError extends Error {
  constructor(message, { code = 'NVIDIA_PROVIDER_ERROR', retryable = false, status = null, operation = '' } = {}) {
    super(message);
    this.name = 'NvidiaProviderError';
    Object.assign(this, { code, retryable, status, operation });
  }
}

async function request(path, body, operation, fetchImpl = fetch) {
  const config = getAiConfig();
  if (!config.enabled || !config.apiKey) throw new NvidiaProviderError('NVIDIA AI is not configured', { code: 'NVIDIA_NOT_CONFIGURED', operation });
  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetchImpl(`${config.baseUrl}${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) return data;
      const retryable = TRANSIENT.has(response.status);
      if (retryable && attempt < config.maxRetries) {
        const retryAfter = Number(response.headers?.get?.('retry-after'));
        await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : Math.min(250 * (2 ** attempt), 2000));
        continue;
      }
      throw new NvidiaProviderError('NVIDIA request failed', {
        code: response.status === 429 ? 'NVIDIA_RATE_LIMITED' : 'NVIDIA_HTTP_ERROR',
        retryable, status: response.status, operation,
      });
    } catch (error) {
      if (error instanceof NvidiaProviderError) throw error;
      const timedOut = error?.name === 'AbortError';
      if (!timedOut && attempt < config.maxRetries) { await sleep(250 * (2 ** attempt)); continue; }
      throw new NvidiaProviderError(timedOut ? 'NVIDIA request timed out' : 'NVIDIA request failed', {
        code: timedOut ? 'NVIDIA_TIMEOUT' : 'NVIDIA_NETWORK_ERROR', retryable: true, operation,
      });
    } finally { clearTimeout(timeout); }
  }
}

export async function createEmbedding({ input, inputType = 'passage', fetchImpl } = {}) {
  const config = getAiConfig();
  const data = await request('/v1/embeddings', {
    model: config.embeddingModel, input: [String(input || '')], input_type: inputType, encoding_format: 'float',
  }, 'embedding', fetchImpl);
  const embedding = data?.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length !== config.embeddingDimensions || embedding.some((value) => !Number.isFinite(value))) {
    throw new NvidiaProviderError('Invalid NVIDIA embedding response', { code: 'NVIDIA_INVALID_EMBEDDING', operation: 'embedding' });
  }
  return { embedding, model: config.embeddingModel, dimensions: embedding.length };
}

export async function rerankDocuments({ query, documents, topN, fetchImpl } = {}) {
  const config = getAiConfig();
  const data = await request('/v1/ranking', {
    model: config.rerankModel, query: { text: String(query || '') },
    passages: documents.map((text) => ({ text: String(text || '') })), top_n: topN,
  }, 'rerank', fetchImpl);
  const rows = data?.rankings || data?.results;
  if (!Array.isArray(rows)) throw new NvidiaProviderError('Invalid NVIDIA rerank response', { code: 'NVIDIA_INVALID_RERANK', operation: 'rerank' });
  const seen = new Set();
  return rows.map((row) => {
    const index = Number(row.index);
    if (!Number.isInteger(index) || index < 0 || index >= documents.length || seen.has(index)) {
      throw new NvidiaProviderError('Invalid NVIDIA rerank response', { code: 'NVIDIA_INVALID_RERANK', operation: 'rerank' });
    }
    seen.add(index);
    return { index, score: Number(row.logit ?? row.score ?? 0) };
  }).slice(0, topN);
}

export async function generateChatCompletion({ messages, maxTokens, fetchImpl } = {}) {
  const config = getAiConfig();
  const data = await request('/v1/chat/completions', {
    model: config.chatModel, messages, max_tokens: maxTokens || config.maxAnswerTokens, temperature: 0.2,
  }, 'chat', fetchImpl);
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new NvidiaProviderError('Empty NVIDIA response', { code: 'NVIDIA_EMPTY_RESPONSE', operation: 'chat' });
  return content;
}
