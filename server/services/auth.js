import crypto from 'crypto';

const requiredAuthEnvVars = ['AUTH_USERNAME', 'AUTH_PASSWORD', 'JWT_SECRET'];
const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

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

export function getAuthConfig() {
  const missing = requiredAuthEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    const error = new Error(`Missing required auth environment variables: ${missing.join(', ')}`);
    error.statusCode = 500;
    error.code = 'AUTH_CONFIG_MISSING';
    throw error;
  }

  return {
    username: process.env.AUTH_USERNAME,
    password: process.env.AUTH_PASSWORD,
    jwtSecret: process.env.JWT_SECRET,
  };
}

export function credentialsMatch(username, password, config = getAuthConfig()) {
  return safeEqual(username, config.username) && safeEqual(password, config.password);
}

export function createToken(username, config = getAuthConfig(), now = new Date()) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAtSeconds = issuedAt + TOKEN_TTL_SECONDS;
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { sub: username, username, iat: issuedAt, exp: expiresAtSeconds };
  const unsignedToken = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = sign(unsignedToken, config.jwtSecret);

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
    if (!decoded.exp || decoded.exp <= Math.floor(now.getTime() / 1000)) return null;
    if (decoded.username !== config.username) return null;
    return decoded;
  } catch {
    return null;
  }
}
