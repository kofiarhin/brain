import { InboxBriefing } from '../models/InboxBriefing.js';
import { crudRouter } from './factory.js';

async function latest(_req, res, next) {
  try {
    const report = await InboxBriefing.findOne({}).sort({ runDate: -1, createdAt: -1 });
    if (!report) return res.status(404).json({ message: 'Not found' });
    return res.json(report);
  } catch (error) {
    return next(error);
  }
}

export default crudRouter(InboxBriefing, { latest });
