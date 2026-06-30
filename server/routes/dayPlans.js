import { Router } from 'express';
import { createCrudController } from '../controllers/crudController.js';
import { DayPlan } from '../models/DayPlan.js';
import { restartDaySession, startDaySession } from '../services/dayPlanSessions.js';
import { getLondonDateKey } from '../services/londonDate.js';

async function latest(_req, res, next) {
  try {
    const todayKey = getLondonDateKey(new Date());
    const item = await DayPlan.findOne({ londonDate: todayKey }).sort({ startTime: -1, createdAt: -1 });
    if (!item) return res.status(404).json({ message: 'No day plan found for today' });
    res.json(item);
  } catch (error) { next(error); }
}

function parsePagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const requestedLimit = Number.parseInt(query.limit, 10) || 1;
  const limit = Math.min(20, Math.max(1, requestedLimit));
  return { page, limit };
}

async function previous(req, res, next) {
  try {
    const todayKey = getLondonDateKey(new Date());
    const { page, limit } = parsePagination(req.query);
    const query = { londonDate: { $lt: todayKey } };
    const sort = { londonDate: -1, startTime: -1, createdAt: -1 };
    const total = await DayPlan.countDocuments(query);
    const totalPages = Math.ceil(total / limit);
    const items = await DayPlan.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      items,
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    });
  } catch (error) { next(error); }
}

async function byDate(req, res, next) {
  try {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const plan = await DayPlan.findOne({ londonDate: date }).sort({ startTime: -1, createdAt: -1 });
    res.json({ date, plan: plan || null });
  } catch (error) { next(error); }
}

function parseRequestNow(req) {
  return req.body?.now ? new Date(req.body.now) : new Date();
}

async function start(req, res, next) {
  try {
    const { dayPlan } = await startDaySession({ now: parseRequestNow(req) });
    res.status(201).json(dayPlan);
  } catch (error) { next(error); }
}

async function restart(req, res, next) {
  try {
    const { dayPlan } = await restartDaySession({ now: parseRequestNow(req) });
    res.status(201).json(dayPlan);
  } catch (error) { next(error); }
}

const router = Router();
const controller = createCrudController(DayPlan);

router.get('/', controller.list);
router.get('/latest', latest);
router.get('/previous', previous);
router.get('/by-date/:date', byDate);
router.post('/start', start);
router.post('/restart', restart);
router.get('/:id', controller.get);
router.post('/', controller.create);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
