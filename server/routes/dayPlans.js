import { DayPlan } from '../models/DayPlan.js';
import { crudRouter } from './factory.js';

async function latest(_req, res, next) {
  try {
    const item = await DayPlan.findOne().sort({ date: -1, createdAt: -1 });
    if (!item) return res.status(404).json({ message: 'No day plans found' });
    res.json(item);
  } catch (error) { next(error); }
}

export default crudRouter(DayPlan, { latest });
