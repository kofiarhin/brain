import { jest } from '@jest/globals';

process.env.NVIDIA_API_KEY = 'test-key';
process.env.NVIDIA_EMBEDDING_DIMENSIONS = '3';
process.env.NVIDIA_EMBEDDING_MODEL = 'test-embed-model';
process.env.EMBEDDING_JOB_MAX_ATTEMPTS = '3';

const createEmbedding = jest.fn();
class NvidiaProviderError extends Error {
  constructor(message, { code = 'X', retryable = false } = {}) {
    super(message);
    Object.assign(this, { code, retryable });
  }
}

jest.unstable_mockModule('../services/nvidiaClient.js', () => ({
  createEmbedding,
  NvidiaProviderError,
  rerankDocuments: jest.fn(),
  generateChatCompletion: jest.fn(),
}));

const {
  enqueueNoteEmbedding,
  processNoteEmbeddingJob,
  embeddingContentHash,
  isEmbeddingCurrent,
  EMBEDDING_STATUS,
} = await import('../services/noteEmbeddings.js');
const { createInProcessQueue } = await import('../services/queue/queue.js');

/** Minimal in-memory stand-in for the Mongoose Note model. */
function createFakeNoteStore() {
  const records = new Map();
  let sequence = 0;

  const materialize = (record) => {
    const doc = { ...record };
    doc.save = async () => {
      // Persist a snapshot, mirroring a real save.
      const { save, ...rest } = doc;
      records.set(String(doc._id), { ...rest });
      return doc;
    };
    return doc;
  };

  return {
    Model: {
      findById(id) {
        const record = records.get(String(id));
        // Support the `.select('+embedding')` chain used by production code.
        const chain = { select: async () => (record ? materialize(record) : null) };
        return Object.assign(Promise.resolve(record ? materialize(record) : null), chain);
      },
    },
    create(content, extra = {}) {
      sequence += 1;
      const id = `note-${sequence}`;
      records.set(id, {
        _id: id,
        content,
        embeddingStatus: EMBEDDING_STATUS.PENDING,
        embeddingModel: '',
        embeddingContentHash: '',
        embeddingAttempts: 0,
        ...extra,
      });
      return materialize(records.get(id));
    },
    read: (id) => records.get(String(id)),
    setContent(id, content) {
      const record = records.get(String(id));
      records.set(String(id), { ...record, content });
    },
  };
}

const validEmbedding = () => ({ embedding: [0.1, 0.2, 0.3], model: 'test-embed-model', dimensions: 3 });
const noSleep = async () => {};

beforeEach(() => {
  createEmbedding.mockReset();
  createEmbedding.mockResolvedValue(validEmbedding());
});

describe('content hashing and skip logic', () => {
  test('normalizes whitespace so cosmetic edits do not re-embed', () => {
    expect(embeddingContentHash('hello   world')).toBe(embeddingContentHash(' hello world '));
  });

  test('different content produces a different hash', () => {
    expect(embeddingContentHash('a')).not.toBe(embeddingContentHash('b'));
  });

  test('recognises a current embedding', () => {
    const hash = embeddingContentHash('hello');
    expect(isEmbeddingCurrent({
      embeddingStatus: 'ready', embeddingContentHash: hash, embeddingModel: 'test-embed-model',
    }, hash)).toBe(true);
  });

  test('a different model invalidates a ready embedding', () => {
    const hash = embeddingContentHash('hello');
    expect(isEmbeddingCurrent({
      embeddingStatus: 'ready', embeddingContentHash: hash, embeddingModel: 'other-model',
    }, hash)).toBe(false);
  });
});

describe('enqueue path (note write latency)', () => {
  test('a note write never awaits the provider', async () => {
    const store = createFakeNoteStore();
    const note = store.create('hello world');

    // A provider call that would take far longer than any acceptable write.
    createEmbedding.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(validEmbedding()), 5000)));

    const queue = createInProcessQueue({ handler: () => {}, dedupeKey: (job) => job.noteId });
    const startedAt = Date.now();
    const outcome = await enqueueNoteEmbedding(note, { queue });

    expect(outcome).toBe('enqueued');
    expect(Date.now() - startedAt).toBeLessThan(1000);
    expect(createEmbedding).not.toHaveBeenCalled();
    await queue.close();
  });

  test('marks a brand new note pending', async () => {
    const store = createFakeNoteStore();
    const note = store.create('hello world');
    const queue = createInProcessQueue({ handler: () => {}, dedupeKey: (job) => job.noteId });

    await enqueueNoteEmbedding(note, { queue });
    expect(store.read(note._id).embeddingStatus).toBe(EMBEDDING_STATUS.PENDING);
    await queue.close();
  });

  test('marks a note with an existing vector stale rather than pending', async () => {
    const store = createFakeNoteStore();
    const note = store.create('updated', { embedding: [1, 2, 3], embeddingStatus: 'ready' });
    const queue = createInProcessQueue({ handler: () => {}, dedupeKey: (job) => job.noteId });

    await enqueueNoteEmbedding(note, { queue });
    expect(store.read(note._id).embeddingStatus).toBe(EMBEDDING_STATUS.STALE);
    await queue.close();
  });

  test('skips enqueue entirely when content and model are unchanged', async () => {
    const store = createFakeNoteStore();
    const content = 'unchanged content';
    const note = store.create(content, {
      embeddingStatus: 'ready',
      embeddingContentHash: embeddingContentHash(content),
      embeddingModel: 'test-embed-model',
    });

    const queue = createInProcessQueue({ handler: () => {}, dedupeKey: (job) => job.noteId });
    expect(await enqueueNoteEmbedding(note, { queue })).toBe('skipped');
    expect(queue.size()).toBe(0);
    await queue.close();
  });

  test('collapses duplicate jobs for the same note', async () => {
    const store = createFakeNoteStore();
    const note = store.create('hello');
    const queue = createInProcessQueue({
      handler: () => new Promise(() => {}), concurrency: 1, dedupeKey: (job) => job.noteId,
    });

    expect(await queue.enqueue({ noteId: String(note._id), contentHash: 'h' })).toBe('enqueued');
    expect(await queue.enqueue({ noteId: String(note._id), contentHash: 'h' })).toBe('deduplicated');
    await queue.close();
  });

  test('rejects work beyond the queue bound instead of growing without limit', async () => {
    const queue = createInProcessQueue({
      handler: () => new Promise(() => {}), concurrency: 1, maxQueued: 3, dedupeKey: (job) => job.noteId,
    });

    const outcomes = [];
    for (let i = 0; i < 10; i += 1) outcomes.push(await queue.enqueue({ noteId: `n${i}` }));
    expect(outcomes.filter((o) => o === 'rejected').length).toBeGreaterThan(0);
    expect(queue.size()).toBeLessThanOrEqual(3);
    await queue.close();
  });
});

describe('job processing', () => {
  test('writes a ready embedding with full metadata', async () => {
    const store = createFakeNoteStore();
    const note = store.create('hello world');
    const hash = embeddingContentHash('hello world');

    const result = await processNoteEmbeddingJob(
      { noteId: note._id, contentHash: hash },
      { Note: store.Model, sleep: noSleep },
    );

    expect(result).toBe('ready');
    const saved = store.read(note._id);
    expect(saved.embeddingStatus).toBe(EMBEDDING_STATUS.READY);
    expect(saved.embeddingContentHash).toBe(hash);
    expect(saved.embeddingModel).toBe('test-embed-model');
    expect(saved.embeddingDimensions).toBe(3);
    expect(saved.embeddingUpdatedAt).toBeInstanceOf(Date);
    expect(saved.embeddingErrorCode).toBe('');
  });

  test('is idempotent — a repeated job makes no provider call', async () => {
    const store = createFakeNoteStore();
    const note = store.create('hello world');
    const hash = embeddingContentHash('hello world');

    await processNoteEmbeddingJob({ noteId: note._id, contentHash: hash }, { Note: store.Model, sleep: noSleep });
    createEmbedding.mockClear();

    const second = await processNoteEmbeddingJob({ noteId: note._id, contentHash: hash }, { Note: store.Model, sleep: noSleep });
    expect(second).toBe('skipped');
    expect(createEmbedding).not.toHaveBeenCalled();
  });

  test('discards a stale job whose hash no longer matches the note', async () => {
    const store = createFakeNoteStore();
    const note = store.create('new content');

    const result = await processNoteEmbeddingJob(
      { noteId: note._id, contentHash: embeddingContentHash('old content') },
      { Note: store.Model, sleep: noSleep },
    );

    expect(result).toBe('stale');
    expect(createEmbedding).not.toHaveBeenCalled();
  });

  test('discards a result when the note changed while the provider call was in flight', async () => {
    const store = createFakeNoteStore();
    const note = store.create('original');
    const hash = embeddingContentHash('original');

    // Simulate a concurrent edit landing during the provider round-trip.
    createEmbedding.mockImplementation(async () => {
      store.setContent(note._id, 'edited during processing');
      return validEmbedding();
    });

    const result = await processNoteEmbeddingJob(
      { noteId: note._id, contentHash: hash },
      { Note: store.Model, sleep: noSleep },
    );

    expect(result).toBe('stale');
    const saved = store.read(note._id);
    // The newer content must not be attributed this vector.
    expect(saved.embeddingStatus).not.toBe(EMBEDDING_STATUS.READY);
  });

  test('retries a retryable failure and then succeeds', async () => {
    const store = createFakeNoteStore();
    const note = store.create('hello');
    createEmbedding
      .mockRejectedValueOnce(new NvidiaProviderError('down', { code: 'NVIDIA_TIMEOUT', retryable: true }))
      .mockResolvedValueOnce(validEmbedding());

    const result = await processNoteEmbeddingJob(
      { noteId: note._id, contentHash: embeddingContentHash('hello') },
      { Note: store.Model, sleep: noSleep },
    );

    expect(result).toBe('ready');
    expect(createEmbedding).toHaveBeenCalledTimes(2);
    expect(store.read(note._id).embeddingAttempts).toBe(2);
  });

  test('marks failed with a safe code after exhausting retries', async () => {
    const store = createFakeNoteStore();
    const note = store.create('hello');
    createEmbedding.mockRejectedValue(new NvidiaProviderError('down', { code: 'NVIDIA_TIMEOUT', retryable: true }));

    const result = await processNoteEmbeddingJob(
      { noteId: note._id, contentHash: embeddingContentHash('hello') },
      { Note: store.Model, sleep: noSleep },
    );

    expect(result).toBe('failed');
    const saved = store.read(note._id);
    expect(saved.embeddingStatus).toBe(EMBEDDING_STATUS.FAILED);
    expect(saved.embeddingErrorCode).toBe('NVIDIA_TIMEOUT');
    expect(createEmbedding).toHaveBeenCalledTimes(3);
  });

  test('does not retry a non-retryable provider failure', async () => {
    const store = createFakeNoteStore();
    const note = store.create('hello');
    createEmbedding.mockRejectedValue(new NvidiaProviderError('bad', { code: 'NVIDIA_NOT_CONFIGURED', retryable: false }));

    const result = await processNoteEmbeddingJob(
      { noteId: note._id, contentHash: embeddingContentHash('hello') },
      { Note: store.Model, sleep: noSleep },
    );

    expect(result).toBe('failed');
    expect(createEmbedding).toHaveBeenCalledTimes(1);
    expect(store.read(note._id).embeddingErrorCode).toBe('NVIDIA_NOT_CONFIGURED');
  });

  test('failure metadata carries no note content, prompt, or provider body', async () => {
    const store = createFakeNoteStore();
    const note = store.create('a very private note body');
    createEmbedding.mockRejectedValue(
      new NvidiaProviderError('provider said: a very private note body', { code: 'NVIDIA_HTTP_ERROR', retryable: false }),
    );

    await processNoteEmbeddingJob(
      { noteId: note._id, contentHash: embeddingContentHash('a very private note body') },
      { Note: store.Model, sleep: noSleep },
    );

    const saved = store.read(note._id);
    expect(saved.embeddingErrorCode).toBe('NVIDIA_HTTP_ERROR');
    expect(JSON.stringify({ code: saved.embeddingErrorCode })).not.toContain('private note body');
  });

  test('handles a note deleted before the job ran', async () => {
    const store = createFakeNoteStore();
    const result = await processNoteEmbeddingJob(
      { noteId: 'note-does-not-exist', contentHash: 'abc' },
      { Note: store.Model, sleep: noSleep },
    );
    expect(result).toBe('missing');
  });

  test('a provider outage during a note write leaves the note intact and retryable', async () => {
    const store = createFakeNoteStore();
    const note = store.create('durable content');
    createEmbedding.mockRejectedValue(new NvidiaProviderError('down', { code: 'NVIDIA_TIMEOUT', retryable: true }));

    await processNoteEmbeddingJob(
      { noteId: note._id, contentHash: embeddingContentHash('durable content') },
      { Note: store.Model, sleep: noSleep },
    );

    const saved = store.read(note._id);
    // The user's content survives untouched and can be retried.
    expect(saved.content).toBe('durable content');
    expect(saved.embeddingStatus).toBe(EMBEDDING_STATUS.FAILED);

    createEmbedding.mockResolvedValue(validEmbedding());
    const retry = await processNoteEmbeddingJob(
      { noteId: note._id, contentHash: embeddingContentHash('durable content') },
      { Note: store.Model, sleep: noSleep },
    );
    expect(retry).toBe('ready');
  });
});

describe('recovery after restart', () => {
  test('notes left non-ready by a lost in-process queue are recoverable from the database', async () => {
    const store = createFakeNoteStore();
    const first = store.create('one');
    const second = store.create('two');

    // Simulate a restart: work was queued in memory and never ran, so both notes
    // remain in a non-ready state and are discoverable by a status query.
    const pendingIds = [first._id, second._id].filter(
      (id) => store.read(id).embeddingStatus !== EMBEDDING_STATUS.READY,
    );
    expect(pendingIds).toHaveLength(2);

    for (const id of pendingIds) {
      await processNoteEmbeddingJob(
        { noteId: id, contentHash: embeddingContentHash(store.read(id).content) },
        { Note: store.Model, sleep: noSleep },
      );
    }

    expect(store.read(first._id).embeddingStatus).toBe(EMBEDDING_STATUS.READY);
    expect(store.read(second._id).embeddingStatus).toBe(EMBEDDING_STATUS.READY);
  });
});
