import { jest } from '@jest/globals';
import { generateChatCompletion, getGrokModel, GrokProviderError } from '../services/grokClient.js';

const originalEnv = process.env;
const originalFetch = global.fetch;

beforeEach(() => {
  jest.useRealTimers();
  process.env = { ...originalEnv, XAI_API_KEY: 'test-key', GROK_MODEL: 'test-model', XAI_API_URL: 'https://api.x.ai/v1' };
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: 'Grok response' } }] }),
  }));
});

afterEach(() => {
  process.env = originalEnv;
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

test('getGrokModel defaults when GROK_MODEL is unset', () => {
  delete process.env.GROK_MODEL;
  expect(getGrokModel()).toBe('grok-4.3');
});

test('generateChatCompletion posts to xAI chat completions endpoint', async () => {
  const content = await generateChatCompletion({ prompt: 'Brain prompt' });

  expect(content).toBe('Grok response');
  expect(global.fetch).toHaveBeenCalledWith('https://api.x.ai/v1/chat/completions', expect.objectContaining({
    method: 'POST',
    headers: { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'test-model',
      messages: [{ role: 'user', content: 'Brain prompt' }],
      max_tokens: 700,
    }),
  }));
});

test('generateChatCompletion accepts full endpoint override', async () => {
  process.env.XAI_API_URL = 'https://example.test/v1/chat/completions';
  await generateChatCompletion({ prompt: 'Brain prompt' });
  expect(global.fetch).toHaveBeenCalledWith('https://example.test/v1/chat/completions', expect.any(Object));
});

test('generateChatCompletion throws provider error when API key is missing', async () => {
  delete process.env.XAI_API_KEY;
  await expect(generateChatCompletion({ prompt: 'Brain prompt' })).rejects.toThrow(GrokProviderError);
});

test('generateChatCompletion throws provider error for empty responses', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ choices: [] }) }));
  await expect(generateChatCompletion({ prompt: 'Brain prompt' })).rejects.toThrow('Empty Grok response');
});

test('generateChatCompletion surfaces xAI error messages', async () => {
  global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({ error: { message: 'rate limited' } }) }));
  await expect(generateChatCompletion({ prompt: 'Brain prompt' })).rejects.toThrow('rate limited');
});
