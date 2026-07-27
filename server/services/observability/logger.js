/**
 * Privacy-safe structured logging.
 *
 * Emits one JSON object per operational event. Two independent defences keep
 * secrets and private content out of the log stream:
 *
 *   1. A key denylist drops fields whose *name* implies a secret or private
 *      payload (`password`, `token`, `apiKey`, `authorization`, `content`, ...).
 *   2. A value scrubber rewrites secret-shaped *values* (bearer tokens, JWTs,
 *      MongoDB connection strings, NVIDIA-style keys) wherever they appear,
 *      including inside strings that were otherwise allowed through.
 *
 * Callers are still expected to pass counts, codes, and durations rather than
 * raw material. The redaction layer is a safety net, not a licence to log
 * note bodies, prompts, or provider response bodies.
 *
 * A focused internal module is used deliberately instead of adding a logging
 * dependency: the repository has no logger today and the required surface is
 * small.
 */

const REDACTED = '[redacted]';

/** Field names that must never be emitted, matched case-insensitively as substrings. */
const DENIED_KEY_PATTERNS = [
  'password', 'passwd', 'secret', 'token', 'jwt', 'apikey', 'api_key',
  'authorization', 'auth_header', 'cookie', 'credential', 'connectionstring',
  'connection_string', 'mongodb_uri', 'mongodburi', 'embedding', 'vector',
  'prompt', 'content', 'body', 'note', 'answer', 'message', 'query', 'text',
];

/** Value shapes that must be scrubbed wherever they appear. */
const VALUE_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi,               // Authorization header values
  /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]+/g, // JWTs
  /\bmongodb(?:\+srv)?:\/\/[^\s"']+/gi,               // MongoDB connection strings
  /\bnvapi-[A-Za-z0-9_-]{8,}/gi,                      // NVIDIA API keys
];

const isDeniedKey = (key) => {
  const lower = String(key).toLowerCase();
  return DENIED_KEY_PATTERNS.some((pattern) => lower.includes(pattern));
};

export function scrubValue(value) {
  if (typeof value !== 'string') return value;
  return VALUE_PATTERNS.reduce((text, pattern) => text.replace(pattern, REDACTED), value);
}

/**
 * Recursively strip denied keys and scrub secret-shaped values.
 * Depth is bounded so a hostile or cyclic payload cannot stall the logger.
 */
export function redact(input, depth = 0) {
  if (depth > 4) return REDACTED;
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') return scrubValue(input);
  if (typeof input === 'number' || typeof input === 'boolean') return input;
  if (input instanceof Date) return input.toISOString();
  if (Array.isArray(input)) return input.slice(0, 20).map((entry) => redact(entry, depth + 1));

  if (typeof input === 'object') {
    const output = {};
    for (const [key, value] of Object.entries(input)) {
      output[key] = isDeniedKey(key) ? REDACTED : redact(value, depth + 1);
    }
    return output;
  }

  return REDACTED;
}

const LEVELS = { debug: 20, info: 30, warn: 40, error: 50 };

function activeLevel() {
  const configured = String(process.env.LOG_LEVEL || '').toLowerCase();
  if (LEVELS[configured]) return LEVELS[configured];
  return process.env.NODE_ENV === 'test' ? LEVELS.error : LEVELS.info;
}

const writerFor = (level) => {
  if (level === 'error') return console.error;
  if (level === 'warn') return console.warn;
  return console.log;
};

/**
 * Emit one structured event.
 *
 * @param {string} level  debug | info | warn | error
 * @param {string} event  stable snake_case event name, e.g. `nvidia_request_failed`
 * @param {object} fields safe structured fields (counts, codes, durations, ids)
 */
export function logEvent(level, event, fields = {}) {
  if ((LEVELS[level] || LEVELS.info) < activeLevel()) return;

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...redact(fields),
  };

  writerFor(level)(JSON.stringify(payload));
}

export const logDebug = (event, fields) => logEvent('debug', event, fields);
export const logInfo = (event, fields) => logEvent('info', event, fields);
export const logWarn = (event, fields) => logEvent('warn', event, fields);
export const logError = (event, fields) => logEvent('error', event, fields);

/**
 * Bind a component name (and optionally a correlation id) so call sites stay terse.
 */
export function createLogger(component, base = {}) {
  const withBase = (fields) => ({ component, ...base, ...fields });
  return {
    debug: (event, fields) => logDebug(event, withBase(fields)),
    info: (event, fields) => logInfo(event, withBase(fields)),
    warn: (event, fields) => logWarn(event, withBase(fields)),
    error: (event, fields) => logError(event, withBase(fields)),
    child: (extra) => createLogger(component, { ...base, ...extra }),
  };
}
