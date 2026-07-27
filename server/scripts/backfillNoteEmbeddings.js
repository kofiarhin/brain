import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { Note } from '../models/Note.js';
import { embedNote } from '../services/noteEmbeddings.js';

const dryRun = process.argv.includes('--dry-run');
const batchSize = Math.max(1, Number(process.env.AI_BACKFILL_BATCH_SIZE || 10));

async function main() {
  await connectDB();
  const query = { embeddingStatus: { $ne: 'ready' } };
  const total = await Note.countDocuments(query);
  if (dryRun) return console.log(JSON.stringify({ dryRun: true, remaining: total }));
  let ready = 0; let failed = 0;
  while (true) {
    const notes = await Note.find(query).select('+embedding').limit(batchSize);
    if (!notes.length) break;
    for (const note of notes) {
      await embedNote(note);
      note.embeddingStatus === 'ready' ? ready += 1 : failed += 1;
    }
    if (notes.every((note) => note.embeddingStatus !== 'ready')) break;
  }
  const remaining = await Note.countDocuments(query);
  console.log(JSON.stringify({ ready, failed, remaining }));
  if (failed) process.exitCode = 1;
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
