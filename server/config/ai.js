const number = (name, fallback) => {
  const value = Number.parseInt(process.env[name] || '', 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};
const enabled = (name, fallback = true) => process.env[name] == null
  ? fallback
  : ['1', 'true', 'yes', 'on'].includes(process.env[name].toLowerCase());

export function getAiConfig() {
  return {
    enabled: enabled('NVIDIA_AI_ENABLED'),
    vectorEnabled: enabled('NVIDIA_VECTOR_SEARCH_ENABLED'),
    rerankEnabled: enabled('NVIDIA_RERANK_ENABLED'),
    apiKey: process.env.NVIDIA_API_KEY || '',
    baseUrl: (process.env.NVIDIA_API_BASE_URL || 'https://integrate.api.nvidia.com').replace(/\/+$/, ''),
    chatModel: process.env.NVIDIA_CHAT_MODEL || 'meta/llama-3.1-70b-instruct',
    embeddingModel: process.env.NVIDIA_EMBEDDING_MODEL || 'nvidia/llama-3.2-nv-embedqa-1b-v2',
    rerankModel: process.env.NVIDIA_RERANK_MODEL || 'nvidia/llama-3.2-nv-rerankqa-1b-v2',
    embeddingDimensions: number('NVIDIA_EMBEDDING_DIMENSIONS', 2048),
    vectorIndex: process.env.NVIDIA_VECTOR_INDEX || 'note_embedding_vector_index',
    timeoutMs: number('NVIDIA_REQUEST_TIMEOUT_MS', 30000),
    maxRetries: Number.parseInt(process.env.NVIDIA_MAX_RETRIES || '2', 10),
    questionLimit: number('AI_QUESTION_LIMIT_PER_MINUTE', 5),
    candidates: number('AI_VECTOR_CANDIDATES', 20),
    results: number('AI_RERANKED_RESULTS', 5),
    maxContextChars: number('AI_MAX_CONTEXT_CHARS', 18000),
    maxAnswerTokens: number('AI_MAX_ANSWER_TOKENS', 700),
  };
}
