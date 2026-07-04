const GMAIL_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';

export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getGoogleOAuthConfig() {
  return {
    clientId: requiredEnv('GOOGLE_CLIENT_ID'),
    clientSecret: requiredEnv('GOOGLE_CLIENT_SECRET'),
    redirectUri: requiredEnv('GOOGLE_REDIRECT_URI'),
    state: process.env.GMAIL_OAUTH_STATE || '',
    scope: process.env.GMAIL_SCOPES || GMAIL_READONLY_SCOPE,
  };
}

export function buildGmailAuthUrl() {
  const config = getGoogleOAuthConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: config.scope,
  });

  if (config.state) params.set('state', config.state);
  return `${GMAIL_AUTH_URL}?${params.toString()}`;
}

async function postTokenRequest(body) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || 'Google token request failed');
  }

  return payload;
}

export async function exchangeCodeForTokens(code) {
  const config = getGoogleOAuthConfig();
  return postTokenRequest({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  });
}

export async function refreshAccessToken(refreshToken) {
  const config = getGoogleOAuthConfig();
  return postTokenRequest({
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
  });
}

async function gmailFetch(path, accessToken, options = {}) {
  const response = await fetch(`${GMAIL_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || 'Gmail API request failed');
  return payload;
}

export async function fetchGmailProfile(accessToken) {
  return gmailFetch('/users/me/profile', accessToken);
}

export async function listGmailMessageIds(accessToken, { query, maxResults = 25 } = {}) {
  const params = new URLSearchParams({ maxResults: String(maxResults) });
  if (query) params.set('q', query);
  const payload = await gmailFetch(`/users/me/messages?${params.toString()}`, accessToken);
  return payload.messages || [];
}

export async function fetchGmailMessageMetadata(accessToken, messageId) {
  const params = new URLSearchParams({
    format: 'metadata',
    metadataHeaders: ['From', 'To', 'Subject', 'Date'].join('&metadataHeaders='),
  });
  return gmailFetch(`/users/me/messages/${messageId}?${params.toString()}`, accessToken);
}
