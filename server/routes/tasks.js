import { Task } from '../models/Task.js';
import { crudRouter } from './factory.js';
import { rescheduleTask } from '../services/taskScheduling.js';

const router = crudRouter(Task, { statusActions: true });

router.patch('/:id/reschedule', async (req, res, next) => {
  try {
    const task = await rescheduleTask(req.params.id, {
      targetDate: req.body?.targetDate,
      reason: req.body?.reason,
    });
    res.json(task);
  } catch (error) {
    next(error);
  }
});

export default router;
