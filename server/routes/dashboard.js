import { Router } from 'express';
import { getDashboardSummary } from '../services/dashboardSummary.js';

const router = Router();

router.get('/summary', async (_req, res, next) => {
  try {
    res.json(await getDashboardSummary());
  } catch (error) {
    next(error);
  }
});

export default router;
