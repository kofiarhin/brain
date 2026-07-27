import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
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
import dashboardRouter from './routes/dashboard.js';
import chatRouter from './routes/chat.js';
import authRouter from './routes/auth.js';
import healthRouter from './routes/health.js';
import { requireAuth } from './middleware/auth.js';
import { getAuthConfig } from './services/auth.js';
import { requestContext } from './middleware/requestContext.js';
import { notFound, errorHandler } from './middleware/error.js';
import { envBoolean, envList } from './config/parse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.resolve(__dirname, '../package.json');
const packageInfo = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

/**
 * Legacy compatibility allowlist.
 *
 * These entries predate `CORS_ALLOWED_ORIGINS` and are retained so the existing
 * Vercel/Heroku deployment keeps working. The wildcard preview patterns match
 * ANY `brain-*.vercel.app` host, which is not an origin this project exclusively
 * controls. Set `CORS_STRICT_ORIGINS=true` in production to disable the patterns
 * and honour only `CORS_ALLOWED_ORIGINS` plus `CLIENT_URL`.
 */
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

/** Explicit, documented, comma-separated production allowlist. */
function configuredOrigins() {
  return envList('CORS_ALLOWED_ORIGINS').map(normalizeOrigin).filter(Boolean);
}

export function isOriginAllowed(origin) {
  // A missing Origin header means a same-origin or non-browser client.
  if (!origin) return true;

  const normalizedOrigin = normalizeOrigin(origin);
  const configuredClientOrigin = normalizeOrigin(process.env.CLIENT_URL);
  const explicit = configuredOrigins();

  if (explicit.includes(normalizedOrigin)) return true;
  if (normalizedOrigin === configuredClientOrigin) return true;

  if (envBoolean('CORS_STRICT_ORIGINS', false)) return false;

  return staticAllowedOrigins.has(normalizedOrigin)
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
  // Authentication is a Bearer token in the Authorization header, not a cookie,
  // so credentialed CORS is deliberately NOT enabled.
  credentials: false,
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

/**
 * Resolve `trust proxy` explicitly.
 *
 * Express treats any truthy value as "trust everything", so an accidental
 * `TRUST_PROXY=maybe` would make `req.ip` attacker-controlled via
 * `X-Forwarded-For` — which would let a single source evade the login limiter.
 * Only documented boolean spellings and explicit hop counts are honoured.
 */
export function resolveTrustProxy(raw = process.env.TRUST_PROXY) {
  if (raw === null || raw === undefined || String(raw).trim() === '') return false;
  const text = String(raw).trim().toLowerCase();
  if (/^\d+$/.test(text)) return Number(text);
  if (['true', 'yes', 'on', '1'].includes(text)) return 1;
  return false;
}

function helmetOptions() {
  // The API is consumed cross-origin by the Vercel frontend, so resource policy
  // must permit cross-origin reads. CSP is opt-out because a future inline-script
  // requirement in the served SPA would otherwise break silently.
  const base = {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  };

  if (!envBoolean('SECURITY_CSP_ENABLED', true)) {
    return { ...base, contentSecurityPolicy: false };
  }

  return {
    ...base,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        // The Tailwind build injects style attributes at runtime.
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", ...configuredOrigins()],
        fontSrc: ["'self'", 'data:'],
      },
    },
  };
}

export function createApp(options = {}) {
  const app = express();
  app.locals.authConfig = getAuthConfig();

  // Explicit, validated proxy trust — never an arbitrary truthy string.
  app.set('trust proxy', options.trustProxy ?? resolveTrustProxy());
  app.disable('x-powered-by');

  app.use(helmet(helmetOptions()));
  app.use(requestContext);
  app.options('*', cors(corsOptions));
  app.use(cors(corsOptions));

  const bodyLimit = process.env.REQUEST_BODY_LIMIT || '1mb';
  app.use(express.json({ limit: bodyLimit }));
  app.use(express.urlencoded({ extended: false, limit: bodyLimit }));

  app.use('/api', healthRouter);
  app.get('/api/version', (_req, res) => res.json({
    name: packageInfo.name,
    version: packageInfo.version,
    environment: process.env.NODE_ENV || 'development',
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));
  app.get('/api/cors-debug', (req, res) => {
    const origin = req.get('origin') || null;
    res.json({
      origin,
      allowed: isOriginAllowed(origin),
      accessControlAllowOrigin: res.get('Access-Control-Allow-Origin') || null,
    });
  });
  app.use('/api/auth', authRouter);
  app.use('/api/dashboard', requireAuth, dashboardRouter);
  app.use('/api/chat', requireAuth, chatRouter);
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
