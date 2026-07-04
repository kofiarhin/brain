import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import notesRouter from './routes/notes.js';
import tasksRouter from './routes/tasks.js';
import deliverablesRouter from './routes/deliverables.js';
import goalsRouter from './routes/goals.js';
import projectsRouter from './routes/projects.js';
import ideasRouter from './routes/ideas.js';
import contextRouter from './routes/context.js';
import preferencesRouter from './routes/preferences.js';
import reviewsRouter from './routes/reviews.js';
import dayPlansRouter from './routes/dayPlans.js';
import brainUpdateReportsRouter from './routes/brainUpdateReports.js';
import generatedPostsRouter from './routes/generatedPosts.js';
import inboxReportsRouter from './routes/inboxReports.js';
import authRouter from './routes/auth.js';
import { requireAuth } from './middleware/auth.js';
import { getAuthConfig } from './services/auth.js';
import { notFound, errorHandler } from './middleware/error.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function clientDistPath() {
  return path.resolve(__dirname, '../client/dist');
}

function shouldServeClient(options) {
  if (typeof options.serveClient === 'boolean') return options.serveClient;
  return process.env.NODE_ENV === 'production';
}

function configureClientStatic(app, options = {}) {
  if (!shouldServeClient(options)) return;

  const distPath = options.clientDistPath || clientDistPath();
  const indexPath = path.join(distPath, 'index.html');
  if (!fs.existsSync(indexPath)) return;

  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) return next();
    return res.sendFile(indexPath);
  });
}

export function createApp(options = {}) {
  const app = express();
  app.locals.authConfig = getAuthConfig();
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
  app.use('/api/auth', authRouter);
  app.use('/api/notes', requireAuth, notesRouter);
  app.use('/api/tasks', requireAuth, tasksRouter);
  app.use('/api/deliverables', requireAuth, deliverablesRouter);
  app.use('/api/goals', requireAuth, goalsRouter);
  app.use('/api/projects', requireAuth, projectsRouter);
  app.use('/api/ideas', requireAuth, ideasRouter);
  app.use('/api/context', requireAuth, contextRouter);
  app.use('/api/preferences', requireAuth, preferencesRouter);
  app.use('/api/reviews', requireAuth, reviewsRouter);
  app.use('/api/day-plans', requireAuth, dayPlansRouter);
  app.use('/api/brain-update-reports', requireAuth, brainUpdateReportsRouter);
  app.use('/api/generated-posts', requireAuth, generatedPostsRouter);
  app.use('/api/inbox-reports', requireAuth, inboxReportsRouter);

  configureClientStatic(app, options);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
