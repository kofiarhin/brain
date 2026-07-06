const DEFAULT_MODEL = 'openai/gpt-oss-120b:fastest';
const DEFAULT_API_URL = 'https://router.huggingface.co/v1/chat/completions';
const TIMEOUT_MS = 45_000;

export class HuggingFaceProviderError extends Error {
  constructor(message = 'Hugging Face provider failure') {
    super(message);
    this.name = 'HuggingFaceProviderError';
  }
}

function normalizeProviderText(data) {
  const messageContent = data?.choices?.[0]?.message?.content;
  if (typeof messageContent === 'string') return messageContent;
  if (Array.isArray(messageContent)) {
    return messageContent
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .join('');
  }
  if (Array.isArray(data)) return data[0]?.generated_text || data[0]?.summary_text || '';
  if (typeof data?.generated_text === 'string') return data.generated_text;
  if (typeof data?.summary_text === 'string') return data.summary_text;
  return '';
}

export async function generateChatCompletion({ messages, prompt }) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) throw new HuggingFaceProviderError('Missing Hugging Face API key');

  const model = process.env.HUGGINGFACE_MODEL || DEFAULT_MODEL;
  const apiUrl = process.env.HUGGINGFACE_API_URL || DEFAULT_API_URL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const normalizedMessages = Array.isArray(messages) && messages.length
    ? messages
    : [{ role: 'user', content: prompt }];

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: normalizedMessages,
        max_tokens: 700,
        temperature: 0.3,
      }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.error) {
      const message = typeof data?.error === 'string' ? data.error : data?.error?.message;
      throw new HuggingFaceProviderError(message || 'Hugging Face request failed');
    }
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
