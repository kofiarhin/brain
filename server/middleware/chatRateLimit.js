import { getAiConfig } from '../config/ai.js';
const state = new Map();
export function chatRateLimit(req, res, next) {
  const now = Date.now();
  const key = req.user?.username || req.ip || 'user';
  const bucket = !state.get(key) || state.get(key).resetAt <= now ? { count: 0, resetAt: now + 60000 } : state.get(key);
  if (bucket.count >= getAiConfig().questionLimit) {
    res.set('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
    return res.status(429).json({ message: 'AI question limit reached. Please retry shortly.' });
  }
  bucket.count += 1;
  state.set(key, bucket);
  return next();
}
export const resetChatRateLimits = () => state.clear();
