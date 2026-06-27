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
import brainUpdateReportsRouter from './routes/brainUpdateReports.js';
import { notFound, errorHandler } from './middleware/error.js';

const staticAllowedOrigins = new Set([
  'http://localhost:5173',
  'https://brain-pi-black.vercel.app',
  'https://brain-92pysn6ss-kofi-arhins-projects.vercel.app',
]);

const vercelOriginPatterns = [
  /^https:\/\/brain-[a-z0-9-]+\.vercel\.app$/i,
  /^https:\/\/brain-[a-z0-9-]+-kofi-arhins-projects\.vercel\.app$/i,
];

function normalizeOrigin(value) {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/$/, '');
  }
}

export function isOriginAllowed(origin) {
  if (!origin) return true;

  const normalizedOrigin = normalizeOrigin(origin);
  const configuredClientOrigin = normalizeOrigin(process.env.CLIENT_URL);

  return staticAllowedOrigins.has(normalizedOrigin)
    || normalizedOrigin === configuredClientOrigin
    || vercelOriginPatterns.some((pattern) => pattern.test(normalizedOrigin));
}

function corsOrigin(origin, callback) {
  callback(null, isOriginAllowed(origin));
}

const corsOptions = {
  origin: corsOrigin,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};

export function createApp() {
  const app = express();
  app.options('*', cors(corsOptions));
  app.use(cors(corsOptions));
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/cors-debug', (req, res) => {
    const origin = req.get('origin') || null;
    res.json({
      origin,
      allowed: isOriginAllowed(origin),
      accessControlAllowOrigin: res.get('Access-Control-Allow-Origin') || null,
    });
  });
  app.use('/api/notes', notesRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/deliverables', deliverablesRouter);
  app.use('/api/goals', goalsRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/ideas', ideasRouter);
  app.use('/api/context', contextRouter);
  app.use('/api/reviews', reviewsRouter);
  app.use('/api/day-plans', dayPlansRouter);
  app.use('/api/brain-update-reports', brainUpdateReportsRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
