import crypto from 'crypto';

const requiredAuthEnvVars = ['AUTH_USERNAME', 'AUTH_PASSWORD', 'JWT_SECRET'];

/**
 * Default access-token lifetime.
 *
 * Previously 30 days. A month-long bearer token held in browser storage means a
 * single token disclosure grants a month of access, so the default is now one
 * working day. `JWT_EXPIRES_IN=1h` is the recommended hardened production value
 * and is what `.env.example` ships.
 *
 * The default is deliberately NOT 1h: this project has no refresh-token flow,
 * and silently shortening every existing deployment to hourly re-authentication
 * would be a behaviour change beyond the remit of this work. Introducing refresh
 * tokens is recorded as a future recommendation in docs/OPERATIONS.md.
 */
export const DEFAULT_TOKEN_TTL_SECONDS = 12 * 60 * 60;

/** Reject absurd lifetimes in either direction. */
const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Minimum JWT secret length enforced in production. */
export const MIN_JWT_SECRET_LENGTH = 32;

/** Secrets that must never authenticate a production deployment. */
const FORBIDDEN_PRODUCTION_SECRETS = new Set([
  'secret', 'changeme', 'change-me', 'password', 'jwt-secret', 'test-secret', 'dev', 'development',
]);

/**
 * Parse a duration such as `900`, `30s`, `15m`, `1h`, or `7d` into seconds.
 * Invalid input falls back to the default rather than producing NaN.
 */
export function parseDuration(raw, fallback = DEFAULT_TOKEN_TTL_SECONDS) {
  if (raw === null || raw === undefined) return fallback;

  const text = String(raw).trim().toLowerCase();
  const match = text.match(/^(\d+)\s*(s|m|h|d)?$/);
  if (!match) return fallback;

  const value = Number(match[1]);
  if (!Number.isSafeInteger(value) || value <= 0) return fallback;

  const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[match[2] || 's'];
  const seconds = value * multiplier;

  if (seconds < MIN_TTL_SECONDS || seconds > MAX_TTL_SECONDS) return fallback;
  return seconds;
}

export const getTokenTtlSeconds = () => parseDuration(process.env.JWT_EXPIRES_IN);

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlJson(value) {
  return base64UrlEncode(JSON.stringify(value));
}

function sign(unsignedToken, secret) {
  return crypto.createHmac('sha256', secret).update(unsignedToken).digest('base64url');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * Validate JWT configuration strength.
 *
 * Enforced only in production so local development and the test suite keep
 * working with short fixtures. Returns a list of problems rather than throwing,
 * so the caller controls failure behaviour.
 */
export function validateJwtSecret(secret, { production = process.env.NODE_ENV === 'production' } = {}) {
  const problems = [];
  if (!production) return problems;

  const value = String(secret || '');
  if (value.length < MIN_JWT_SECRET_LENGTH) {
    problems.push(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters in production`);
  }
  if (FORBIDDEN_PRODUCTION_SECRETS.has(value.toLowerCase())) {
    problems.push('JWT_SECRET must not be a well-known placeholder value');
  }
  return problems;
}

export function getAuthConfig() {
  const missing = requiredAuthEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    const error = new Error(`Missing required auth environment variables: ${missing.join(', ')}`);
    error.statusCode = 500;
    error.code = 'AUTH_CONFIG_MISSING';
    throw error;
  }

  // There is no built-in fallback secret: a missing JWT_SECRET fails above.
  const problems = validateJwtSecret(process.env.JWT_SECRET);
  if (problems.length > 0) {
    // The message names the variable and the rule, never the value itself.
    const error = new Error(`Invalid auth configuration: ${problems.join('; ')}`);
    error.statusCode = 500;
    error.code = 'AUTH_CONFIG_WEAK';
    throw error;
  }

  return {
    username: process.env.AUTH_USERNAME,
    password: process.env.AUTH_PASSWORD,
    jwtSecret: process.env.JWT_SECRET,
    tokenTtlSeconds: getTokenTtlSeconds(),
  };
}

export function credentialsMatch(username, password, config = getAuthConfig()) {
  return safeEqual(username, config.username) && safeEqual(password, config.password);
}

export function createToken(username, config = getAuthConfig(), now = new Date()) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const ttl = config.tokenTtlSeconds || getTokenTtlSeconds();
  const expiresAtSeconds = issuedAt + ttl;
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { sub: username, username, iat: issuedAt, exp: expiresAtSeconds };
  const unsignedToken = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = sign(unsignedToken, config.jwtSecret);

  // Deliberately minimal: no secret, no password, no server configuration.
  return {
    token: `${unsignedToken}.${signature}`,
    username,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
  };
}

export function verifyToken(token, config = getAuthConfig(), now = new Date()) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const unsignedToken = `${header}.${payload}`;
  const expectedSignature = sign(unsignedToken, config.jwtSecret);
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    // Reject anything not signed with HS256 to prevent algorithm confusion.
    const decodedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    if (decodedHeader?.alg !== 'HS256') return null;
    if (!decoded.exp || decoded.exp <= Math.floor(now.getTime() / 1000)) return null;
    if (decoded.username !== config.username) return null;
    return decoded;
  } catch {
    return null;
  }
}
