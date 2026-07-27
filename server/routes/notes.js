import { Router } from 'express';
import { Note } from '../models/Note.js';
import { enqueueNoteEmbedding } from '../services/noteEmbeddings.js';

const router = Router();

/**
 * Embedding is enqueued, never awaited, on every write path. A note is durable
 * as soon as it is persisted; its embedding converges afterwards. Enqueue
 * failures are deliberately swallowed — the note is already saved, its status
 * stays non-`ready`, and the backfill command can recover it.
 */
async function scheduleEmbedding(note) {
  try {
    return await enqueueNoteEmbedding(note);
  } catch {
    return 'rejected';
  }
}

router.get('/', async (req, res, next) => {
  try { return res.json(await Note.find(req.query || {}).sort({ createdAt: -1 })); } catch (error) { return next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);
    return note ? res.json(note) : res.status(404).json({ message: 'Not found' });
  } catch (error) { return next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const note = await Note.create({ content: req.body?.content });
    await scheduleEmbedding(note);
    return res.status(201).json(note);
  } catch (error) { return next(error); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const note = await Note.findByIdAndUpdate(
      req.params.id,
      { content: req.body?.content },
      { new: true, runValidators: true, select: '+embedding' },
    );
    if (!note) return res.status(404).json({ message: 'Not found' });
    await scheduleEmbedding(note);
    return res.json(note);
  } catch (error) { return next(error); }
});

router.post('/:id/retry-embedding', async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id).select('+embedding');
    if (!note) return res.status(404).json({ message: 'Not found' });
    await scheduleEmbedding(note);
    return res.json(note);
  } catch (error) { return next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const note = await Note.findByIdAndDelete(req.params.id);
    return note ? res.status(204).send() : res.status(404).json({ message: 'Not found' });
  } catch (error) { return next(error); }
});

export default router;
