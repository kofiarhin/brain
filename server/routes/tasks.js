import { Task } from '../models/Task.js';
import { crudRouter } from './factory.js';
export default crudRouter(Task, { statusActions: true });
