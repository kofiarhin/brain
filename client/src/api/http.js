const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    localStorage.removeItem('brain.auth');
    authFailureHandler?.();
    if (window.location.pathname !== '/login') window.location.assign('/login');
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'API request failed');
  return data;
}
