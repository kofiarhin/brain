import { verifyToken } from '../services/auth.js';

export function requireAuth(req, res, next) {
  let authConfig;
  try {
    authConfig = req.app.locals.authConfig;
    if (!authConfig) throw new Error('Missing required auth environment variables: AUTH_USERNAME, AUTH_PASSWORD, JWT_SECRET');
  } catch (error) {
    error.statusCode = 500;
    return next(error);
  }

  const authorization = req.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const payload = verifyToken(token, authConfig);
  if (!payload) return res.status(401).json({ message: 'Invalid or expired token' });

  req.user = { username: payload.username };
  return next();
}
