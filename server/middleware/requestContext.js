import crypto from 'crypto';

/**
 * Attach a correlation id to every request so structured log events emitted
 * across the NVIDIA client, embedding queue, and rate limiters can be joined
 * without logging any request content.
 *
 * An inbound `X-Request-Id` is honoured (trimmed and length-capped) so a proxy
 * or client trace id survives; otherwise one is generated.
 */
export function requestContext(req, res, next) {
  const inbound = String(req.get('x-request-id') || '').trim().slice(0, 64);
  const requestId = /^[A-Za-z0-9._-]+$/.test(inbound) ? inbound : crypto.randomUUID();

  req.requestId = requestId;
  res.set('X-Request-Id', requestId);
  return next();
}
