import { Router } from 'express';
import { createCrudController, createStatusActions } from '../controllers/crudController.js';

export function crudRouter(Model, options = {}) {
  const router = Router();
  const controller = createCrudController(Model);
  router.get('/', controller.list);
  if (options.latest) router.get('/latest', options.latest);
  router.get('/:id', controller.get);
  router.post('/', controller.create);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);

  if (options.statusActions) {
    const status = createStatusActions(Model);
    router.patch('/:id/complete', status.complete);
    router.patch('/:id/reopen', status.reopen);
    router.patch('/:id/archive', status.archive);
  }

  return router;
}
