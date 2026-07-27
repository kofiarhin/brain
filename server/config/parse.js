/**
 * Strict environment-value parsing helpers.
 *
 * Every helper is total: it always returns a usable value of the documented type
 * and never returns `NaN`, `undefined`, or a value outside the requested bounds.
 * Invalid input falls back to the supplied default rather than propagating a
 * broken value into request-control logic (see `NVIDIA_MAX_RETRIES`, which
 * previously produced `NaN` and silently disabled the retry loop).
 */

const INTEGER_PATTERN = /^[+-]?\d+$/;

/**
 * Parse a strictly-bounded integer.
 *
 * Rejects decimals, empty strings, whitespace-only strings, non-numeric text,
 * `Infinity`, and values outside [min, max]. Values that parse cleanly but fall
 * outside the bounds are clamped; values that do not parse at all use `fallback`.
 *
 * @returns {number} an integer within [min, max]
 */
export function boundedInteger(raw, { fallback, min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const safeFallback = Math.min(Math.max(fallback, min), max);
  if (raw === null || raw === undefined) return safeFallback;

  const text = String(raw).trim();
  if (!INTEGER_PATTERN.test(text)) return safeFallback;

  const value = Number(text);
  if (!Number.isSafeInteger(value)) return safeFallback;

  return Math.min(Math.max(value, min), max);
}

/** Read a bounded integer straight from `process.env`. */
export function envInteger(name, options) {
  return boundedInteger(process.env[name], options);
}

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

/**
 * Parse an explicit boolean flag.
 *
 * Only the documented true/false spellings are honoured. Any other string is
 * ambiguous and resolves to `fallback` rather than being treated as truthy,
 * which prevents `TRUST_PROXY=maybe` from silently enabling proxy trust.
 */
export function booleanFlag(raw, fallback = false) {
  if (raw === null || raw === undefined) return fallback;
  const text = String(raw).trim().toLowerCase();
  if (TRUE_VALUES.has(text)) return true;
  if (FALSE_VALUES.has(text)) return false;
  return fallback;
}

/** Read an explicit boolean flag straight from `process.env`. */
export function envBoolean(name, fallback = false) {
  return booleanFlag(process.env[name], fallback);
}

/** Parse a comma-separated list into trimmed, de-duplicated, non-empty entries. */
export function csvList(raw) {
  if (raw === null || raw === undefined) return [];
  return [...new Set(
    String(raw)
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  )];
}

/** Read a comma-separated list straight from `process.env`. */
export function envList(name) {
  return csvList(process.env[name]);
}
