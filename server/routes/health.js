import { Router } from 'express';
import mongoose from 'mongoose';
import { getAiConfig } from '../config/ai.js';
import { describeRateLimitStores } from '../services/rateLimit/index.js';
import { describeEmbeddingQueue } from '../services/queue/index.js';

const router = Router();

/**
 * GET /api/health — LIVENESS.
 *
 * Answers only "is this process running and able to serve HTTP?". It never
 * touches MongoDB or NVIDIA, so a provider outage cannot cause a restart loop.
 * The response shape `{ status: 'ok' }` is unchanged from previous releases.
 *
 * A passing liveness check does NOT mean the deployment is production-ready.
 * Use /api/ready for dependency state and the opt-in smoke test for real
 * provider verification.
 */
router.get('/health', (_req, res) => res.json({ status: 'ok' }));

const MONGO_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

function describeMongo() {
  const state = MONGO_STATES[mongoose.connection?.readyState] || 'unknown';
  // Never expose the connection string, host, credentials, or database name.
  return { state, required: true, ok: state === 'connected' };
}

function describeNvidia() {
  const config = getAiConfig();
  return {
    // Presence only — the key itself is never read into the response.
    configured: Boolean(config.apiKey),
    enabled: config.enabled,
    chatModel: config.chatModel,
    embeddingModel: config.embeddingModel,
    required: false,
  };
}

function describeVectorCapability() {
  const config = getAiConfig();
  return {
    enabled: config.vectorEnabled,
    indexName: config.vectorIndex,
    embeddingDimensions: config.embeddingDimensions,
    required: false,
    // Whether the Atlas index actually exists is NOT probed here: it would cost a
    // query per health check. Verify it with the opt-in smoke test instead.
    verified: false,
  };
}

/**
 * GET /api/ready — READINESS.
 *
 * Distinguishes required infrastructure (MongoDB) from optional/degradable AI
 * services (NVIDIA, Atlas Vector Search) and from infrastructure that is present
 * but running in a limited mode (memory rate-limit store, in-process queue).
 *
 * Status semantics:
 *   ok       — required dependencies healthy, nothing degraded
 *   degraded — required dependencies healthy, optional/limited components flagged
 *   unavailable (503) — a required dependency is down
 */
router.get('/ready', (_req, res) => {
  const mongo = describeMongo();
  const rateLimit = describeRateLimitStores();
  const queue = describeEmbeddingQueue();
  const nvidia = describeNvidia();
  const vector = describeVectorCapability();

  const degradedReasons = [];
  if (rateLimit.auth.degraded || rateLimit.chat.degraded) degradedReasons.push('rate_limit_store_fallback');
  if (!rateLimit.auth.distributed || !rateLimit.chat.distributed) degradedReasons.push('rate_limit_store_not_distributed');
  if (!queue.durable) degradedReasons.push('embedding_queue_not_durable');
  if (!nvidia.configured && nvidia.enabled) degradedReasons.push('nvidia_not_configured');

  const status = !mongo.ok ? 'unavailable' : (degradedReasons.length ? 'degraded' : 'ok');

  return res.status(mongo.ok ? 200 : 503).json({
    status,
    components: {
      application: { ok: true, required: true },
      mongodb: mongo,
      rateLimitStore: rateLimit,
      embeddingQueue: queue,
      nvidia,
      vectorSearch: vector,
    },
    degradedReasons,
    timestamp: new Date().toISOString(),
  });
});

export default router;
