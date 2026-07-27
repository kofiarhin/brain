import mongoose from 'mongoose';
import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';

const JOB_NAME = 'brain.embed-note';
const DEFAULT_COLLECTION = 'brainEmbeddingJobs';
const DEFAULT_PROCESS_EVERY = '5 seconds';
const DEFAULT_LOCK_LIFETIME_MS = 120000;

function requirePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function activeJobFilter(noteId) {
  return {
    name: JOB_NAME,
    'data.noteId': String(noteId),
    nextRunAt: { $ne: null },
  };
}

/**
 * Durable MongoDB-backed embedding queue for the MVP single-web-process topology.
 * Job payloads contain only noteId and contentHash; note content and credentials
 * remain outside the queue collection.
 */
export async function createAgendaEmbeddingQueue({
  handler,
  concurrency = 1,
  maxQueued = 500,
  collection = process.env.AGENDA_COLLECTION || DEFAULT_COLLECTION,
  processEvery = process.env.AGENDA_PROCESS_EVERY || DEFAULT_PROCESS_EVERY,
  lockLifetimeMs = requirePositiveInteger(
    process.env.AGENDA_LOCK_LIFETIME_MS,
    DEFAULT_LOCK_LIFETIME_MS,
  ),
  mongoDb = mongoose.connection?.db,
  AgendaClass = Agenda,
  MongoBackendClass = MongoBackend,
} = {}) {
  if (typeof handler !== 'function') throw new TypeError('Agenda queue handler is required');
  if (!mongoDb) {
    const error = new Error('MongoDB must be connected before the Agenda queue starts');
    error.code = 'AGENDA_MONGODB_NOT_CONNECTED';
    throw error;
  }

  const workerConcurrency = requirePositiveInteger(concurrency, 1);
  const queueLimit = requirePositiveInteger(maxQueued, 500);
  let waiting = 0;
  let active = 0;
  let closed = false;
  let idleResolvers = [];

  const settleIdle = () => {
    if (active === 0 && waiting === 0) {
      idleResolvers.forEach((resolve) => resolve());
      idleResolvers = [];
    }
  };

  const backend = new MongoBackendClass({ mongo: mongoDb, collection });
  const agenda = new AgendaClass({
    backend,
    processEvery,
    defaultConcurrency: workerConcurrency,
    maxConcurrency: workerConcurrency,
    defaultLockLimit: workerConcurrency,
    lockLimit: workerConcurrency,
    defaultLockLifetime: lockLifetimeMs,
    removeOnComplete: true,
  });

  agenda.define(JOB_NAME, async (agendaJob) => {
    waiting = Math.max(0, waiting - 1);
    active += 1;
    try {
      await handler(agendaJob?.attrs?.data || {});
    } finally {
      active -= 1;
      settleIdle();
    }
  }, {
    concurrency: workerConcurrency,
    lockLimit: workerConcurrency,
    lockLifetime: lockLifetimeMs,
  });

  await agenda.start();

  const initial = await agenda.queryJobs({ name: JOB_NAME, nextRunAt: { $ne: null } });
  waiting = Number(initial?.total || initial?.jobs?.length || 0);

  return {
    name: 'agenda',
    durable: true,

    async enqueue(job) {
      if (closed) return 'rejected';
      const noteId = job?.noteId && String(job.noteId);
      if (!noteId) return 'rejected';

      const existing = await agenda.queryJobs(activeJobFilter(noteId), { limit: 1 });
      if (Number(existing?.total || existing?.jobs?.length || 0) > 0) return 'deduplicated';

      if (waiting >= queueLimit) return 'rejected';

      const agendaJob = agenda.create(JOB_NAME, {
        noteId,
        contentHash: job?.contentHash ? String(job.contentHash) : '',
      });
      agendaJob.unique({ name: JOB_NAME, 'data.noteId': noteId }, { insertOnly: true });
      agendaJob.schedule(new Date());
      await agendaJob.save();
      waiting += 1;
      return 'enqueued';
    },

    size() { return waiting; },
    inFlight() { return active; },

    drain() {
      if (active === 0 && waiting === 0) return Promise.resolve();
      return new Promise((resolve) => { idleResolvers.push(resolve); });
    },

    async close() {
      closed = true;
      await agenda.stop();
      waiting = 0;
      settleIdle();
    },
  };
}

export function createAgendaEmbeddingQueueAdapter(options = {}) {
  return createAgendaEmbeddingQueue(options);
}

export { JOB_NAME as AGENDA_EMBEDDING_JOB_NAME };
