import express from 'express';
import { createToken, credentialsMatch } from '../services/auth.js';
import { createAuthRateLimit } from '../middleware/authRateLimit.js';
import { createLogger } from '../services/observability/logger.js';

const router = express.Router();
const log = createLogger('auth');

/**
 * Brute-force / credential-stuffing protection runs before credential
 * comparison so throttled attempts never reach the secret-comparison path.
 */
router.post('/login', (req, res, next) => createAuthRateLimit()(req, res, next), (req, res, next) => {
  try {
    const authConfig = req.app.locals.authConfig;
    const { username = '', password = '' } = req.body || {};

    if (!credentialsMatch(username, password, authConfig)) {
      // Logged without the attempted username or password.
      log.warn('auth_login_rejected', { reason: 'INVALID_CREDENTIALS' });
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    log.info('auth_login_succeeded', {});
    return res.json(createToken(authConfig.username, authConfig));
  } catch (error) {
    return next(error);
  }
});

export default router;
