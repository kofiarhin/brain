import express from 'express';
import cors from 'cors';
import notesRouter from './routes/notes.js';
import tasksRouter from './routes/tasks.js';
import deliverablesRouter from './routes/deliverables.js';
import goalsRouter from './routes/goals.js';
import projectsRouter from './routes/projects.js';
import ideasRouter from './routes/ideas.js';
import contextRouter from './routes/context.js';
import reviewsRouter from './routes/reviews.js';
import dayPlansRouter from './routes/dayPlans.js';
import { notFound, errorHandler } from './middleware/error.js';

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
].filter(Boolean);

function corsOrigin(origin, callback) {
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes(origin)) return callback(null, true);
  if (/^https:\/\/brain-[a-z0-9-]+-kofi-arhins-projects\.vercel\.app$/.test(origin)) {
    return callback(null, true);
  }
  if (origin === 'https://brain-pi-black.vercel.app') return callback(null, true);
  return callback(null, false);
}

export function createApp() {
  const app = express();
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/notes', notesRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/deliverables', deliverablesRouter);
  app.use('/api/goals', goalsRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/ideas', ideasRouter);
  app.use('/api/context', contextRouter);
  app.use('/api/reviews', reviewsRouter);
  app.use('/api/day-plans', dayPlansRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
