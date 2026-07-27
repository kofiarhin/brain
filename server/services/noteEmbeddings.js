import crypto from 'crypto';
import { getAiConfig } from '../config/ai.js';
import { createEmbedding, NvidiaProviderError } from './nvidiaClient.js';
import { getEmbeddingQueue, getEmbeddingQueueConfig, setEmbeddingJobHandler } from './queue/index.js';
import { createLogger } from './observability/logger.js';

const log = createLogger('note-embeddings');

export const normalizeEmbeddableContent = (value) => String(value || '').trim().replace(/\s+/g, ' ');
export const embeddingContentHash = (value) => crypto.createHash('sha256')
  .update(normalizeEmbeddableContent(value))
  .digest('hex');

/** Terminal + transitional states tracked on the Note document. */
export const EMBEDDING_STATUS = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed',
  STALE: 'stale',
});

/** True when the stored embedding already matches this content and model. */
export function isEmbeddingCurrent(note, hash, config = getAiConfig()) {
  return note?.embeddingStatus === EMBEDDING_STATUS.READY
    && note?.embeddingContentHash === hash
    && note?.embeddingModel === config.embeddingModel;
}

/**
 * Mark a note as awaiting embedding and enqueue the work.
 *
 * This is the ONLY function the note create/update path calls. It performs one
 * fast document write and returns; it never awaits a provider call, so a slow or
 * unavailable NVIDIA endpoint cannot delay or fail a note write.
 *
 * @returns {Promise<'skipped'|'enqueued'|'deduplicated'|'rejected'>}
 */
export async function enqueueNoteEmbedding(note, { queue = getEmbeddingQueue() } = {}) {
  if (!note) return 'skipped';

  const config = getAiConfig();
  const hash = embeddingContentHash(note.content);

  // Unchanged embeddable content and model — no provider call needed.
  if (isEmbeddingCurrent(note, hash, config)) return 'skipped';

  note.embeddingStatus = note.embedding?.length ? EMBEDDING_STATUS.STALE : EMBEDDING_STATUS.PENDING;
  note.embeddingErrorCode = '';
  note.embeddingQueuedAt = new Date();
  await note.save();

  const outcome = await queue.enqueue({ noteId: String(note._id), contentHash: hash });

  log.info('embedding_enqueued', {
    noteId: String(note._id), outcome, status: note.embeddingStatus,
  });

  return outcome;
}

/**
 * Execute one embedding job.
 *
 * Safety properties:
 *   - Idempotent: if the note already has a `ready` embedding for this exact
 *     content hash and model, the job exits without calling the provider.
 *   - Stale-job rejection: a job whose `contentHash` no longer matches the note's
 *     current content is discarded. Newer content already has its own job.
 *   - Stale-result rejection: the content hash is re-checked AFTER the provider
 *     returns. If the note changed while the request was in flight, the result is
 *     discarded rather than overwriting the newer content's embedding.
 *   - Bounded retries with backoff, then a terminal `failed` state carrying only
 *     a safe error code.
 */
export async function processNoteEmbeddingJob(job, { Note, sleep = defaultSleep } = {}) {
  const NoteModel = Note || (await import('../models/Note.js')).Note;
  const config = getAiConfig();
  const { maxAttempts } = getEmbeddingQueueConfig();
  const noteId = job?.noteId;

  const note = await NoteModel.findById(noteId).select('+embedding');
  if (!note) {
    log.warn('embedding_job_skipped', { noteId, reason: 'NOTE_DELETED' });
    return 'missing';
  }

  const currentHash = embeddingContentHash(note.content);

  if (isEmbeddingCurrent(note, currentHash, config)) {
    log.info('embedding_job_skipped', { noteId, reason: 'ALREADY_CURRENT' });
    return 'skipped';
  }

  if (job?.contentHash && job.contentHash !== currentHash) {
    // The note moved on after this job was queued; a newer job owns it.
    log.info('embedding_job_skipped', { noteId, reason: 'STALE_JOB' });
    return 'stale';
  }

  note.embeddingStatus = EMBEDDING_STATUS.PROCESSING;
  await note.save();

  let lastErrorCode = 'EMBEDDING_FAILED';

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const result = await createEmbedding({
        input: normalizeEmbeddableContent(note.content),
        inputType: 'passage',
      });

      // Re-read: the note may have been edited while the provider call was in
      // flight. Applying this vector would attribute it to content it never saw.
      const fresh = await NoteModel.findById(noteId).select('+embedding');
      if (!fresh) return 'missing';

      if (embeddingContentHash(fresh.content) !== currentHash) {
        log.info('embedding_result_discarded', { noteId, reason: 'CONTENT_CHANGED_DURING_PROCESSING' });
        return 'stale';
      }

      Object.assign(fresh, {
        embedding: result.embedding,
        embeddingModel: result.model,
        embeddingDimensions: result.dimensions,
        embeddingContentHash: currentHash,
        embeddingStatus: EMBEDDING_STATUS.READY,
        embeddingUpdatedAt: new Date(),
        embeddingErrorCode: '',
        embeddingAttempts: attempt + 1,
      });
      await fresh.save();

      log.info('embedding_job_completed', {
        noteId, attempts: attempt + 1, dimensions: result.dimensions,
      });
      return 'ready';
    } catch (error) {
      lastErrorCode = error instanceof NvidiaProviderError ? error.code : 'EMBEDDING_FAILED';
      const retryable = error instanceof NvidiaProviderError ? error.retryable : false;
      const isFinal = attempt === maxAttempts - 1;

      log.warn('embedding_job_attempt_failed', {
        noteId, attempt: attempt + 1, code: lastErrorCode, retryable, final: isFinal,
      });

      if (!retryable || isFinal) break;
      await sleep(Math.min(250 * (2 ** attempt), 4000));
    }
  }

  const failed = await NoteModel.findById(noteId).select('+embedding');
  if (!failed) return 'missing';

  // Do not clobber a newer successful embedding written meanwhile.
  if (failed.embeddingStatus === EMBEDDING_STATUS.READY
    && failed.embeddingContentHash !== currentHash) return 'stale';

  failed.embeddingStatus = EMBEDDING_STATUS.FAILED;
  // Safe code only — never the provider body, note content, or credentials.
  failed.embeddingErrorCode = lastErrorCode;
  failed.embeddingAttempts = maxAttempts;
  await failed.save();

  log.warn('embedding_job_failed', { noteId, code: lastErrorCode, attempts: maxAttempts });
  return 'failed';
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Wire the worker into the queue registry.
setEmbeddingJobHandler((job) => processNoteEmbeddingJob(job));

/**
 * Synchronous embed-and-wait.
 *
 * Retained for the CLI backfill/recovery command, which is explicitly a bounded
 * batch process and SHOULD wait for each provider call. Request handlers must use
 * `enqueueNoteEmbedding` instead.
 */
export async function embedNote(note) {
  if (!note) return note;
  const config = getAiConfig();
  const hash = embeddingContentHash(note.content);
  if (isEmbeddingCurrent(note, hash, config)) return note;

  const { Note } = await import('../models/Note.js');
  await processNoteEmbeddingJob({ noteId: String(note._id), contentHash: hash }, { Note });

  const refreshed = await Note.findById(note._id).select('+embedding');
  return refreshed || note;
}
