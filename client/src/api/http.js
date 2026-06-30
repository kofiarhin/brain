export const API_UNREACHABLE_MESSAGE = 'Could not reach the API server. Check VITE_API_URL or backend deployment.';

export function buildApiBaseUrl(value = import.meta.env.VITE_API_URL) {
  const configuredUrl = value?.trim();
  if (!configuredUrl) return '/api';
  return configuredUrl.replace(/\/+$/, '');
}

export function buildApiUrl(path, baseUrl = buildApiBaseUrl()) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

let authFailureHandler = null;

function getStoredToken() {
  try {
    const auth = JSON.parse(localStorage.getItem('brain.auth') || 'null');
    return auth?.token || null;
  } catch {
    return null;
  }
}

export function setAuthFailureHandler(handler) {
  authFailureHandler = handler;
}

export function clearAuthFailureHandler(handler) {
  if (authFailureHandler === handler) authFailureHandler = null;
}

export async function request(path, options = {}) {
  const token = getStoredToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(buildApiUrl(path), {
      ...options,
      headers
    });
  } catch (error) {
    throw new Error(API_UNREACHABLE_MESSAGE, { cause: error });
  }

  if (response.status === 401) {
    localStorage.removeItem('brain.auth');
    authFailureHandler?.();
    if (window.location.pathname !== '/login') window.location.assign('/login');
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || 'API request failed');
    error.status = response.status;
    throw error;
  }
  return data;
}
