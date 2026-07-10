const DEFAULT_MODEL = 'grok-4.3';
const DEFAULT_API_URL = 'https://api.x.ai/v1/chat/completions';
const TIMEOUT_MS = 45_000;

export class GrokProviderError extends Error {
  constructor(message = 'Grok provider failure') {
    super(message);
    this.name = 'GrokProviderError';
  }
}

function normalizeProviderText(data) {
  return data?.choices?.[0]?.message?.content || '';
}

function buildApiUrl() {
  const configuredUrl = (process.env.XAI_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
  return configuredUrl.endsWith('/chat/completions') ? configuredUrl : `${configuredUrl}/chat/completions`;
}

export function getGrokModel() {
  return process.env.GROK_MODEL || DEFAULT_MODEL;
}

export async function generateChatCompletion({ prompt }) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new GrokProviderError('Missing xAI API key');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(buildApiUrl(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: getGrokModel(),
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 700,
      }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.error) {
      const message = data?.error?.message || data?.error || 'Grok request failed';
      throw new GrokProviderError(message);
    }
    const text = normalizeProviderText(data).trim();
    if (!text) throw new GrokProviderError('Empty Grok response');
    return text;
  } catch (error) {
    if (error instanceof GrokProviderError) throw error;
    throw new GrokProviderError(error.name === 'AbortError' ? 'Grok request timed out' : 'Grok request failed');
  } finally {
    clearTimeout(timeout);
  }
}
