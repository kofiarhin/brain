/**
 * Job queue abstraction.
 *
 * A queue is any object satisfying:
 *
 *   enqueue(job)  -> Promise<'enqueued' | 'deduplicated' | 'rejected'>
 *   size()        -> number   // waiting jobs
 *   inFlight()    -> number   // jobs currently executing
 *   drain()       -> Promise<void>  // resolve when idle (tests/shutdown)
 *   close()       -> Promise<void>
 *   readonly name: string
 *   readonly durable: boolean
 *
 * The bundled `in-process` adapter is NOT durable: queued work is lost on
 * restart, crash, or dyno cycling, and it cannot distribute work across
 * instances. It exists so development and tests need no external broker. Every
 * job it can lose is reconstructable from MongoDB via the backfill command,
 * which is the actual recovery mechanism for this deployment.
 *
 * A durable production backend (BullMQ/Redis, Agenda/Mongo, SQS, ...) plugs in
 * through `registerQueueAdapter()` without changing callers. None is assumed or
 * required here because the repository has no such infrastructure provisioned.
 */

import { createLogger } from '../observability/logger.js';

const log = createLogger('queue');

const adapters = new Map();

export function registerQueueAdapter(name, factory) {
  adapters.set(String(name).toLowerCase(), factory);
}

export function clearQueueAdapters() {
  adapters.clear();
}

export const DEFAULT_CONCURRENCY = 2;
export const DEFAULT_MAX_QUEUED = 500;

/**
 * Bounded in-process worker pool.
 *
 * Bounds:
 *   - `maxQueued` caps waiting jobs; further enqueues are rejected rather than
 *     growing the heap without limit.
 *   - `concurrency` caps simultaneous handler executions, which also bounds
 *     concurrent provider calls.
 *   - `dedupeKey` collapses duplicate work for the same entity while it is
 *     waiting or in flight.
 */
export function createInProcessQueue({
  handler,
  concurrency = DEFAULT_CONCURRENCY,
  maxQueued = DEFAULT_MAX_QUEUED,
  dedupeKey = (job) => job?.id,
} = {}) {
  const waiting = [];
  const pendingKeys = new Set();
  const activeKeys = new Set();
  let active = 0;
  let closed = false;
  let idleResolvers = [];

  const settleIdle = () => {
    if (active === 0 && waiting.length === 0) {
      idleResolvers.forEach((resolve) => resolve());
      idleResolvers = [];
    }
  };

  const pump = () => {
    while (!closed && active < concurrency && waiting.length > 0) {
      const job = waiting.shift();
      const key = dedupeKey(job);
      pendingKeys.delete(key);
      activeKeys.add(key);
      active += 1;

      Promise.resolve()
        .then(() => handler(job))
        .catch((error) => {
          // A handler must not be able to kill the pool.
          log.error('queue_job_failed', { queue: 'in-process', code: error?.code || 'UNKNOWN' });
        })
        .finally(() => {
          active -= 1;
          activeKeys.delete(key);
          settleIdle();
          pump();
        });
    }
    settleIdle();
  };

  return {
    name: 'in-process',
    durable: false,

    async enqueue(job) {
      if (closed) return 'rejected';

      const key = dedupeKey(job);
      // Already queued or running for this entity — the newer job carries the
      // same "re-read current state" instruction, so collapsing is safe.
      if (key !== undefined && (pendingKeys.has(key) || activeKeys.has(key))) return 'deduplicated';

      if (waiting.length >= maxQueued) {
        log.warn('queue_rejected', { queue: 'in-process', reason: 'QUEUE_FULL', maxQueued });
        return 'rejected';
      }

      waiting.push(job);
      if (key !== undefined) pendingKeys.add(key);
      // Defer so enqueue() returns before the handler runs; the HTTP response is
      // never blocked on job execution.
      setImmediate(pump);
      return 'enqueued';
    },

    size() { return waiting.length; },
    inFlight() { return active; },

    drain() {
      if (active === 0 && waiting.length === 0) return Promise.resolve();
      return new Promise((resolve) => { idleResolvers.push(resolve); });
    },

    async close() {
      closed = true;
      waiting.length = 0;
      pendingKeys.clear();
      settleIdle();
    },
  };
}

/**
 * Build the configured queue. Never throws: a broker misconfiguration falls back
 * to the bounded in-process adapter and is reported through readiness.
 */
export async function createQueue({ queueName = 'in-process', handler, ...options } = {}) {
  const requested = String(queueName || 'in-process').toLowerCase();

  if (requested === 'in-process' || requested === 'memory') {
    return { queue: createInProcessQueue({ handler, ...options }), degraded: false, requested };
  }

  const factory = adapters.get(requested);
  if (!factory) {
    log.error('queue_unavailable', { requested, reason: 'ADAPTER_NOT_REGISTERED', fallback: 'in-process' });
    return { queue: createInProcessQueue({ handler, ...options }), degraded: true, requested };
  }

  try {
    const queue = await factory({ handler, ...options });
    if (!queue || typeof queue.enqueue !== 'function') throw new Error('Adapter returned an invalid queue');
    log.info('queue_ready', { requested, durable: Boolean(queue.durable) });
    return { queue, degraded: false, requested };
  } catch (error) {
    log.error('queue_unavailable', {
      requested, reason: 'ADAPTER_INIT_FAILED', code: error?.code || 'UNKNOWN', fallback: 'in-process',
    });
    return { queue: createInProcessQueue({ handler, ...options }), degraded: true, requested };
  }
}
