/**
 * Process-wide embedding queue registry.
 *
 * Mirrors the rate-limit store registry: a bounded in-process queue is available
 * synchronously so `createApp()` stays synchronous, and a deployment with a
 * durable broker swaps it in at startup via `initializeEmbeddingQueue()`.
 */

import { envInteger } from '../../config/parse.js';
import { createInProcessQueue, createQueue } from './queue.js';

export const getEmbeddingQueueConfig = () => ({
  queueName: process.env.EMBEDDING_QUEUE_DRIVER || 'in-process',
  concurrency: envInteger('EMBEDDING_QUEUE_CONCURRENCY', { fallback: 2, min: 1, max: 32 }),
  maxQueued: envInteger('EMBEDDING_QUEUE_MAX_QUEUED', { fallback: 500, min: 1, max: 100000 }),
  maxAttempts: envInteger('EMBEDDING_JOB_MAX_ATTEMPTS', { fallback: 3, min: 1, max: 10 }),
});

const state = {
  queue: null,
  degraded: false,
  requested: 'in-process',
};

/** Lazily created so the handler module can be imported without a cycle. */
function ensureQueue() {
  if (!state.queue) {
    const config = getEmbeddingQueueConfig();
    state.queue = createInProcessQueue({
      handler: (job) => runHandler(job),
      concurrency: config.concurrency,
      maxQueued: config.maxQueued,
      dedupeKey: (job) => job?.noteId,
    });
  }
  return state.queue;
}

/**
 * The worker function is injected rather than imported so the queue module has
 * no dependency on the embedding service (which depends on the queue to enqueue).
 */
let handlerImpl = async () => {};
export function setEmbeddingJobHandler(handler) { handlerImpl = handler; }
const runHandler = (job) => handlerImpl(job);

export const getEmbeddingQueue = () => ensureQueue();

/** Safe snapshot for readiness reporting — contains no job payloads. */
export function describeEmbeddingQueue() {
  const queue = ensureQueue();
  return {
    requested: state.requested,
    active: queue.name,
    durable: Boolean(queue.durable),
    degraded: state.degraded,
    waiting: queue.size(),
    inFlight: queue.inFlight(),
  };
}

export async function initializeEmbeddingQueue() {
  const config = getEmbeddingQueueConfig();
  const { queue, degraded, requested } = await createQueue({
    queueName: config.queueName,
    handler: (job) => runHandler(job),
    concurrency: config.concurrency,
    maxQueued: config.maxQueued,
    dedupeKey: (job) => job?.noteId,
  });

  state.queue = queue;
  state.degraded = degraded;
  state.requested = requested;
  return describeEmbeddingQueue();
}

/** Test helper: fresh bounded in-process queue. */
export async function resetEmbeddingQueue(options = {}) {
  await state.queue?.close?.();
  const config = getEmbeddingQueueConfig();
  state.queue = createInProcessQueue({
    handler: (job) => runHandler(job),
    concurrency: options.concurrency ?? config.concurrency,
    maxQueued: options.maxQueued ?? config.maxQueued,
    dedupeKey: (job) => job?.noteId,
  });
  state.degraded = false;
  state.requested = 'in-process';
  return state.queue;
}

/** Test helper: install a specific queue (e.g. a durable stub). */
export function setEmbeddingQueue(queue, { degraded = false, requested = queue?.name || 'custom' } = {}) {
  state.queue = queue;
  state.degraded = degraded;
  state.requested = requested;
}
