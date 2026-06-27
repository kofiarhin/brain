import { Router } from 'express';
import { createCrudController } from '../controllers/crudController.js';
import { BrainUpdateReport } from '../models/BrainUpdateReport.js';

function buildReportQuery({ status, from, to }) {
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
    const reports = await BrainUpdateReport.find(buildReportQuery(req.query)).sort({ runDate: -1, createdAt: -1 });
    res.json(reports);
  } catch (error) { next(error); }
}

const router = Router();
const controller = createCrudController(BrainUpdateReport);

router.get('/', list);
router.get('/:id', controller.get);
router.post('/', controller.create);
router.delete('/:id', controller.remove);

export default router;
