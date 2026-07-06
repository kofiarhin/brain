const DEFAULT_MODEL = 'mistralai/Mistral-7B-Instruct-v0.3';
const DEFAULT_API_URL = 'https://api-inference.huggingface.co/models';
const TIMEOUT_MS = 45_000;

export class HuggingFaceProviderError extends Error {
  constructor(message = 'Hugging Face provider failure') {
    super(message);
    this.name = 'HuggingFaceProviderError';
  }
}

function normalizeProviderText(data) {
  if (Array.isArray(data)) return data[0]?.generated_text || data[0]?.summary_text || '';
  if (typeof data?.generated_text === 'string') return data.generated_text;
  if (typeof data?.summary_text === 'string') return data.summary_text;
  return '';
}

export async function generateChatCompletion({ prompt }) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) throw new HuggingFaceProviderError('Missing Hugging Face API key');

  const model = process.env.HUGGINGFACE_MODEL || DEFAULT_MODEL;
  const baseUrl = (process.env.HUGGINGFACE_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/${model}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 700, return_full_text: false }, options: { wait_for_model: true } }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.error) throw new HuggingFaceProviderError(data?.error || 'Hugging Face request failed');
    const text = normalizeProviderText(data).trim();
    if (!text) throw new HuggingFaceProviderError('Empty Hugging Face response');
    return text;
  } catch (error) {
    if (error instanceof HuggingFaceProviderError) throw error;
    throw new HuggingFaceProviderError(error.name === 'AbortError' ? 'Hugging Face request timed out' : 'Hugging Face request failed');
  } finally {
    clearTimeout(timeout);
  }
}
