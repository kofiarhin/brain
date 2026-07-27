import { createLogger } from '../services/observability/logger.js';

const log = createLogger('http');

export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * Client-facing error contract.
 *
 * Existing contracts are preserved exactly:
 *   CastError       -> 404 { message: 'Not found' }
 *   ValidationError -> 400 { message: <mongoose validation message> }
 *   error.statusCode -> that status with its message
 *
 * Unclassified failures are the only behaviour change: in production they return
 * a generic message so stack traces, driver internals, connection strings, and
 * provider response bodies cannot leak. The detail is still logged server-side
 * with a correlation id so the response remains diagnosable.
 */
export function errorHandler(error, req, res, _next) {
  if (error.name === 'CastError') return res.status(404).json({ message: 'Not found' });
  if (error.name === 'ValidationError') return res.status(400).json({ message: error.message });

  // Body-parser rejects oversized payloads and malformed JSON with a status.
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body too large' });
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON body' });
  }

  if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });

  log.error('request_failed', {
    requestId: req?.requestId,
    method: req?.method,
    path: req?.route?.path || req?.path,
    name: error?.name,
    code: error?.code,
  });

  const message = isProduction() ? 'Server error' : (error.message || 'Server error');
  return res.status(500).json({ message });
}
