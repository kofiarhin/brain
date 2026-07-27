import { Router } from 'express';
import { Note } from '../models/Note.js';
import { embedNote } from '../services/noteEmbeddings.js';

const router = Router();
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
    await embedNote(note);
    return res.status(201).json(note);
  } catch (error) { return next(error); }
});
router.patch('/:id', async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id).select('+embedding');
    if (!note) return res.status(404).json({ message: 'Not found' });
    if (req.body?.content !== undefined) note.content = req.body.content;
    await note.save();
    await embedNote(note);
    return res.json(note);
  } catch (error) { return next(error); }
});
router.post('/:id/retry-embedding', async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id).select('+embedding');
    if (!note) return res.status(404).json({ message: 'Not found' });
    await embedNote(note);
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
