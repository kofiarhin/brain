import { Task } from '../models/Task.js';
import { crudRouter } from './factory.js';
import { rescheduleTask } from '../services/taskScheduling.js';
import { archiveTask, completeTask, convertTask, dismissTask, reopenTask } from '../services/taskOutcomes.js';

const router = crudRouter(Task);

router.patch('/:id/complete', async (req, res, next) => {
  try {
    res.json(await completeTask(req.params.id));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/reopen', async (req, res, next) => {
  try {
    res.json(await reopenTask(req.params.id));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/archive', async (req, res, next) => {
  try {
    res.json(await archiveTask(req.params.id, {
      reason: req.body?.reason,
      note: req.body?.note,
    }));
  } catch (error) {
    next(error);
  }
});

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

router.patch('/:id/dismiss', async (req, res, next) => {
  try {
    res.json(await dismissTask(req.params.id, {
      reason: req.body?.reason,
      note: req.body?.note,
      markProjectInactive: req.body?.markProjectInactive === true,
    }));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/convert', async (req, res, next) => {
  try {
    res.json(await convertTask(req.params.id, {
      replacementTaskId: req.body?.replacementTaskId,
      replacementTask: req.body?.replacementTask,
      reason: req.body?.reason,
      note: req.body?.note,
    }));
  } catch (error) {
    next(error);
  }
});

export default router;
