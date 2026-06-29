import { describe, expect, test } from 'vitest';
import { buildApiBaseUrl, buildApiUrl } from './http';

describe('API URL builder', () => {
  test('defaults to the same-origin API path', () => {
    expect(buildApiBaseUrl()).toBe('/api');
    expect(buildApiUrl('/auth/login')).toBe('/api/auth/login');
  });

  test.each([
    ['https://example.herokuapp.com/api', 'https://example.herokuapp.com/api/auth/login'],
    ['https://example.herokuapp.com/api/', 'https://example.herokuapp.com/api/auth/login'],
  ])('normalizes configured API URL %s', (configuredUrl, expectedUrl) => {
    expect(buildApiBaseUrl(configuredUrl)).toBe('https://example.herokuapp.com/api');
    expect(buildApiUrl('/auth/login', buildApiBaseUrl(configuredUrl))).toBe(expectedUrl);
  });

  test('accepts paths without a leading slash', () => {
    expect(buildApiUrl('auth/login', '/api')).toBe('/api/auth/login');
  });
});
