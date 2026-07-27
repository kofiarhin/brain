import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { Note } from '../models/Note.js';
import { embedNote, EMBEDDING_STATUS } from '../services/noteEmbeddings.js';
import { envInteger } from '../config/parse.js';
import { getAiConfig } from '../config/ai.js';

/**
 * Embedding backfill and recovery.
 *
 * This command is the durable-recovery mechanism for the in-process embedding
 * queue: because every job's input lives in MongoDB, any work lost to a restart,
 * crash, or dyno cycle can be reconstructed by re-querying notes that are not
 * `ready`. Run it after a restart, after an outage, or after changing the
 * embedding model.
 *
 * Usage:
 *   npm run brain:backfill-embeddings -- --dry-run
 *   npm run brain:backfill-embeddings
 *   npm run brain:backfill-embeddings -- --status=failed --limit=100
 *
 * Progress counts are printed; note content never is.
 */

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const flagValue = (name) => {
  const match = args.find((arg) => arg.startsWith(`--${name}=`));
  return match ? match.split('=').slice(1).join('=') : null;
};

const dryRun = hasFlag('dry-run');
const batchSize = envInteger('AI_BACKFILL_BATCH_SIZE', { fallback: 10, min: 1, max: 500 });
const maxRecords = Number(flagValue('limit')) > 0 ? Number(flagValue('limit')) : Infinity;

/**
 * Which notes to reprocess.
 *   default        -> anything not `ready` (pending, processing, stale, failed)
 *   --status=X     -> only that status
 *   --model-change -> also re-embed `ready` notes built by a different model
 */
function buildQuery() {
  const status = flagValue('status');
  if (status) return { embeddingStatus: status };

  if (hasFlag('model-change')) {
    const { embeddingModel } = getAiConfig();
    return { $or: [{ embeddingStatus: { $ne: EMBEDDING_STATUS.READY } }, { embeddingModel: { $ne: embeddingModel } }] };
  }

  return { embeddingStatus: { $ne: EMBEDDING_STATUS.READY } };
}

async function main() {
  await connectDB();

  const query = buildQuery();
  const total = await Note.countDocuments(query);

  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, matching: total, batchSize }));
    return;
  }

  let ready = 0;
  let failed = 0;
  let skipped = 0;
  let processed = 0;
  let lastId = null;

  // Cursor-style pagination by _id: stable even as documents change status,
  // and resumable because progress is persisted on each note.
  while (processed < maxRecords) {
    const pageQuery = lastId ? { $and: [query, { _id: { $gt: lastId } }] } : query;
    const notes = await Note.find(pageQuery).sort({ _id: 1 }).limit(batchSize).select('+embedding');
    if (!notes.length) break;

    for (const note of notes) {
      if (processed >= maxRecords) break;
      lastId = note._id;
      processed += 1;

      const before = note.embeddingStatus;
      const result = await embedNote(note);

      if (result?.embeddingStatus === EMBEDDING_STATUS.READY) {
        if (before === EMBEDDING_STATUS.READY) skipped += 1; else ready += 1;
      } else {
        failed += 1;
      }
    }

    console.log(JSON.stringify({ progress: { processed, ready, failed, skipped, total } }));
  }

  const remaining = await Note.countDocuments({ embeddingStatus: { $ne: EMBEDDING_STATUS.READY } });
  console.log(JSON.stringify({ ready, failed, skipped, processed, remaining }));

  // A non-zero exit lets a scheduled run alert on incomplete coverage.
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    // Message only — never the connection string or provider payload.
    console.error(JSON.stringify({ error: error?.code || 'BACKFILL_FAILED' }));
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
