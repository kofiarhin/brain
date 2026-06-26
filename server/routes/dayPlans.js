import { Router } from 'express';
import { createCrudController } from '../controllers/crudController.js';
import { DayPlan } from '../models/DayPlan.js';
import { restartDaySession, startDaySession } from '../services/dayPlanSessions.js';

async function latest(_req, res, next) {
  try {
    const active = await DayPlan.findOne({ status: 'active' }).sort({ startTime: -1, createdAt: -1 });
    const item = active || await DayPlan.findOne().sort({ startTime: -1, date: -1, createdAt: -1 });
    if (!item) return res.status(404).json({ message: 'No day plans found' });
    res.json(item);
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
router.post('/start', start);
router.post('/restart', restart);
router.get('/:id', controller.get);
router.post('/', controller.create);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
