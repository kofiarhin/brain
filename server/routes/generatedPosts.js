import { Router } from 'express';
import { GeneratedPost } from '../models/GeneratedPost.js';

function parsePositiveInt(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function buildQuery({ status, from, to }) {
  const query = {};
  if (status) query.status = status;
  const runDate = {};
  if (from) runDate.$gte = new Date(from);
  if (to) {
    const toDate = new Date(to);
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) toDate.setUTCHours(23, 59, 59, 999);
    runDate.$lte = toDate;
  }
  if (Object.keys(runDate).length) query.runDate = runDate;
  return query;
}

async function list(req, res, next) {
  try {
    const page = parsePositiveInt(req.query.page, 1, Number.MAX_SAFE_INTEGER);
    const limit = parsePositiveInt(req.query.limit, 10, 50);
    const query = buildQuery(req.query);
    const [items, total] = await Promise.all([
      GeneratedPost.find(query).sort({ runDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      GeneratedPost.countDocuments(query),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    res.json({ items, pagination: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 } });
  } catch (error) { next(error); }
}

async function get(req, res, next) {
  try {
    const post = await GeneratedPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Not found' });
    return res.json(post);
  } catch (error) { return next(error); }
}

const router = Router();
router.get('/', list);
router.get('/:id', get);

export default router;
