import express from 'express';
import { createToken, credentialsMatch } from '../services/auth.js';

const router = express.Router();

router.post('/login', (req, res, next) => {
  try {
    const authConfig = req.app.locals.authConfig;
    const { username = '', password = '' } = req.body || {};

    if (!credentialsMatch(username, password, authConfig)) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    return res.json(createToken(authConfig.username, authConfig));
  } catch (error) {
    return next(error);
  }
});

export default router;
