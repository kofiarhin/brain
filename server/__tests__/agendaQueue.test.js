import { jest } from '@jest/globals';
import {
  AGENDA_EMBEDDING_JOB_NAME,
  createAgendaEmbeddingQueue,
} from '../services/queue/agenda.js';

class FakeBackend {
  constructor(options) { this.options = options; }
}

class FakeAgendaJob {
  constructor(agenda, name, data) {
    this.agenda = agenda;
    this.attrs = { name, data, nextRunAt: null };
    this.uniqueQuery = null;
    this.uniqueOptions = null;
  }

  unique(query, options) {
    this.uniqueQuery = query;
    this.uniqueOptions = options;
    return this;
  }

  schedule(date) {
    this.attrs.nextRunAt = date;
    return this;
  }

  async save() {
    this.agenda.jobs.push(this);
    return this;
  }
}

class FakeAgenda {
  static instances = [];

  constructor(options) {
    this.options = options;
    this.definitions = new Map();
    this.jobs = [];
    this.started = false;
    this.stopped = false;
    FakeAgenda.instances.push(this);
  }

  define(name, handler, options) {
    this.definitions.set(name, { handler, options });
  }

  async start() { this.started = true; }
  async stop() { this.stopped = true; }

  create(name, data) { return new FakeAgendaJob(this, name, data); }

  async queryJobs(filter) {
    const jobs = this.jobs.filter((job) => {
      if (filter.name && job.attrs.name !== filter.name) return false;
      if (filter['data.noteId'] && job.attrs.data.noteId !== filter['data.noteId']) return false;
      if (filter.nextRunAt?.$ne === null && job.attrs.nextRunAt === null) return false;
      return true;
    });
    return { jobs, total: jobs.length };
  }

  async runNext() {
    const job = this.jobs.shift();
    if (!job) return undefined;
    await this.definitions.get(job.attrs.name).handler(job);
    return job;
  }
}

const buildQueue = async (overrides = {}) => createAgendaEmbeddingQueue({
  handler: jest.fn(),
  mongoDb: { databaseName: 'test' },
  AgendaClass: FakeAgenda,
  MongoBackendClass: FakeBackend,
  collection: 'brainEmbeddingJobsTest',
  processEvery: '1 second',
  concurrency: 1,
  ...overrides,
});

beforeEach(() => {
  FakeAgenda.instances = [];
});

test('starts a durable Agenda queue with bounded embedded-worker settings', async () => {
  const queue = await buildQueue();
  const agenda = FakeAgenda.instances[0];

  expect(queue.name).toBe('agenda');
  expect(queue.durable).toBe(true);
  expect(agenda.started).toBe(true);
  expect(agenda.options.maxConcurrency).toBe(1);
  expect(agenda.options.removeOnComplete).toBe(true);
  expect(agenda.options.backend.options.collection).toBe('brainEmbeddingJobsTest');
  expect(agenda.definitions.get(AGENDA_EMBEDDING_JOB_NAME).options.concurrency).toBe(1);
});

test('stores only safe identifiers and deduplicates active work by noteId', async () => {
  const queue = await buildQueue();
  const agenda = FakeAgenda.instances[0];

  expect(await queue.enqueue({ noteId: 'note-1', contentHash: 'hash-1', content: 'private' }))
    .toBe('enqueued');
  expect(await queue.enqueue({ noteId: 'note-1', contentHash: 'hash-2' }))
    .toBe('deduplicated');

  expect(agenda.jobs).toHaveLength(1);
  expect(agenda.jobs[0].attrs.data).toEqual({ noteId: 'note-1', contentHash: 'hash-1' });
  expect(JSON.stringify(agenda.jobs[0].attrs.data)).not.toContain('private');
  expect(agenda.jobs[0].uniqueQuery).toEqual({
    name: AGENDA_EMBEDDING_JOB_NAME,
    'data.noteId': 'note-1',
  });
  expect(agenda.jobs[0].uniqueOptions).toEqual({ insertOnly: true });
});

test('executes the registered handler and updates readiness counters', async () => {
  const handler = jest.fn().mockResolvedValue('ready');
  const queue = await buildQueue({ handler });
  const agenda = FakeAgenda.instances[0];

  await queue.enqueue({ noteId: 'note-2', contentHash: 'hash-2' });
  expect(queue.size()).toBe(1);
  expect(queue.inFlight()).toBe(0);

  await agenda.runNext();

  expect(handler).toHaveBeenCalledWith({ noteId: 'note-2', contentHash: 'hash-2' });
  expect(queue.size()).toBe(0);
  expect(queue.inFlight()).toBe(0);
  await expect(queue.drain()).resolves.toBeUndefined();
});

test('rejects invalid or over-capacity work and stops cleanly', async () => {
  const queue = await buildQueue({ maxQueued: 1 });
  const agenda = FakeAgenda.instances[0];

  expect(await queue.enqueue({})).toBe('rejected');
  expect(await queue.enqueue({ noteId: 'note-a' })).toBe('enqueued');
  expect(await queue.enqueue({ noteId: 'note-b' })).toBe('rejected');

  await queue.close();
  expect(agenda.stopped).toBe(true);
  expect(await queue.enqueue({ noteId: 'note-c' })).toBe('rejected');
});

test('fails initialization safely when MongoDB is not connected', async () => {
  await expect(createAgendaEmbeddingQueue({
    handler: jest.fn(),
    mongoDb: null,
    AgendaClass: FakeAgenda,
    MongoBackendClass: FakeBackend,
  })).rejects.toMatchObject({ code: 'AGENDA_MONGODB_NOT_CONNECTED' });
});
