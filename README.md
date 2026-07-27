# Brain OS v2

A full-stack MERN Personal Operating System where MongoDB is memory, Codex CLI is the brain, and React is the interface.

## Architecture

- **Frontend:** CRUD-focused. Saves data, retrieves data, displays generated data, and exposes one authenticated read-only chat UI backed by `/api/chat`.
- **MongoDB:** Source of truth for notes, tasks, plans, reviews, goals, projects, ideas, context, and deliverables.
- **Codex CLI:** AI layer. Run commands such as `update life`, `update brain`, `refresh brain`, `plan my day`, and `morning briefing` manually from Codex. Codex reads MongoDB, reasons over the data, and writes updates back to MongoDB.

The application exposes one authenticated AI route, `/api/chat`, for read-only conversational access to MongoDB-backed Brain App context. Write operations remain CRUD-only and Codex-command-driven unless explicitly implemented later.

## Setup

```bash
cp .env.example .env
npm run install:all
npm run dev
```

Local development runs the Express API on `http://localhost:5000` and the Vite client on `http://localhost:5173`. The client defaults to same-origin `/api`; in Vite dev, `client/vite.config.js` proxies `/api` to `http://localhost:5000`.

## Environment

`.env.example` is the authoritative, fully commented reference. Copy it and fill
in real values. Core server settings:

```env
MONGODB_URI=
PORT=5000
CLIENT_URL=http://localhost:5173
AUTH_USERNAME=
AUTH_PASSWORD=
JWT_SECRET=
JWT_EXPIRES_IN=1h
NVIDIA_API_KEY=
NVIDIA_CHAT_MODEL=meta/llama-3.1-70b-instruct
NVIDIA_EMBEDDING_MODEL=nvidia/llama-3.2-nv-embedqa-1b-v2
NVIDIA_RERANK_MODEL=nvidia/llama-3.2-nv-rerankqa-1b-v2
NVIDIA_EMBEDDING_DIMENSIONS=2048
NVIDIA_VECTOR_INDEX=note_embedding_vector_index
NVIDIA_REQUEST_TIMEOUT_MS=30000
NVIDIA_MAX_RETRIES=2
```

`JWT_SECRET` is required, has no fallback, and must be at least 32 characters in
production. `JWT_EXPIRES_IN` accepts `3600`, `15m`, `1h`, `7d`; it defaults to
`12h` when unset, and `1h` is the recommended hardened value.

`NVIDIA_MAX_RETRIES` counts retries, not attempts — `0` means one attempt with no
retries. Invalid values fall back to `2`.

### API hardening

```env
CORS_ALLOWED_ORIGINS=http://localhost:5173
CORS_STRICT_ORIGINS=false
REQUEST_BODY_LIMIT=1mb
TRUST_PROXY=false
```

`CORS_ALLOWED_ORIGINS` is a comma-separated list of exact origins; `CLIENT_URL` is
always allowed too. Legacy `brain-*.vercel.app` preview patterns remain accepted
unless `CORS_STRICT_ORIGINS=true` — set that in production, since those hostnames
are not exclusively controlled by this project.

`TRUST_PROXY` accepts only `false`, `true`, or a hop count; any other string
resolves to `false`. Set it to `1` behind Heroku so rate limiting sees the real
client address. Leaving it `false` behind a proxy is safe but buckets all traffic
under the proxy's address.

Helmet, `X-Powered-By` removal, JSON/urlencoded body limits, and sanitized
production error responses are applied automatically.

### Rate limiting

```env
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX_ATTEMPTS=5
AUTH_RATE_LIMIT_MAX_PER_IP=20
AUTH_RATE_LIMIT_STORE=memory
CHAT_RATE_LIMIT_WINDOW_MS=60000
CHAT_RATE_LIMIT_MAX_REQUESTS=5
CHAT_RATE_LIMIT_STORE=memory
RATE_LIMIT_MAX_KEYS=10000
```

`POST /api/auth/login` is protected against brute force and credential stuffing
by two buckets: per identity+IP, and a per-IP ceiling so rotating usernames
cannot bypass the limit. Throttled requests return `429` with `Retry-After` and a
message identical for existing and non-existing accounts.

> **The `memory` store is per-process.** It cannot enforce limits across multiple
> Heroku dynos and resets on restart. Provision a shared store and register an
> adapter before scaling out — see [docs/OPERATIONS.md](docs/OPERATIONS.md).

### Embedding queue

```env
EMBEDDING_QUEUE_DRIVER=in-process
EMBEDDING_QUEUE_CONCURRENCY=2
EMBEDDING_QUEUE_MAX_QUEUED=500
EMBEDDING_JOB_MAX_ATTEMPTS=3
```

> **The in-process queue is not durable.** Queued embedding work is lost on
> restart. Notes are never lost — they persist before the job is enqueued — and
> lost work is recovered with `npm run brain:backfill-embeddings`.

## NVIDIA retrieval

Create an Atlas Vector Search index named by `NVIDIA_VECTOR_INDEX` on
`notes.embedding`. Its dimensions must match `NVIDIA_EMBEDDING_DIMENSIONS`, use
cosine similarity, and include filters for `embeddingStatus` and
`embeddingModel`.

The embedding model's actual output size, `NVIDIA_EMBEDDING_DIMENSIONS`, and the
index's `numDimensions` must all agree. A mismatched vector is rejected rather
than stored.

Note writes never wait for NVIDIA: a note is persisted immediately, marked
`pending`, and embedded asynchronously. A provider outage cannot slow or fail a
note write.

Backfill existing notes after configuring the index and server environment:

```bash
npm run brain:backfill-embeddings -- --dry-run
npm run brain:backfill-embeddings
npm run brain:backfill-embeddings -- --status=failed
npm run brain:backfill-embeddings -- --model-change
```

The API falls back to keyword note retrieval when embeddings or Atlas Vector
Search are unavailable, and to the existing local read-only response when NVIDIA
chat is unavailable. A fallback result is always reported as `degraded` and is
never labelled as vector grounding. Keep `NVIDIA_API_KEY` server-side; never use a
`VITE_` prefix.

### Live smoke test

`npm test` is fully mocked and never contacts NVIDIA or Atlas. To verify the real
integration against a non-production database:

```bash
RUN_NVIDIA_SMOKE_TEST=true \
SMOKE_TEST_MONGODB_URI="mongodb+srv://.../brain_smoke" \
npm run brain:smoke-test
```

It refuses to run without the explicit opt-in, in a production environment, or
against the primary database, and prints no credentials or note content.

The frontend API base URL is:

- `VITE_API_URL` with trailing slashes removed, when set.
- `/api` when `VITE_API_URL` is unset.

Accepted `VITE_API_URL` examples:

```env
VITE_API_URL=https://example.herokuapp.com/api
VITE_API_URL=https://example.herokuapp.com/api/
```

### Heroku Single-App Deployment

Use this when Heroku serves both the API and the built React app.

Heroku config vars:

```env
MONGODB_URI=
CLIENT_URL=https://YOUR_HEROKU_APP.herokuapp.com
CORS_ALLOWED_ORIGINS=https://YOUR_HEROKU_APP.herokuapp.com
CORS_STRICT_ORIGINS=true
AUTH_USERNAME=
AUTH_PASSWORD=
JWT_SECRET=
JWT_EXPIRES_IN=1h
TRUST_PROXY=1
REQUEST_BODY_LIMIT=1mb
NVIDIA_API_KEY=
NVIDIA_CHAT_MODEL=meta/llama-3.1-70b-instruct
NVIDIA_EMBEDDING_MODEL=nvidia/llama-3.2-nv-embedqa-1b-v2
NVIDIA_RERANK_MODEL=nvidia/llama-3.2-nv-rerankqa-1b-v2
NVIDIA_EMBEDDING_DIMENSIONS=2048
NVIDIA_VECTOR_INDEX=note_embedding_vector_index
```

Set `TRUST_PROXY=1` on Heroku so rate limiting sees the real client IP rather
than the router's.

Do not set `PORT`; Heroku provides it. Do not set `VITE_API_URL`; the production frontend defaults to `/api` on the same Heroku app.

Heroku runs one dyno by default. Before scaling to more than one, read the
rate-limit and queue limitations in [docs/OPERATIONS.md](docs/OPERATIONS.md).

The root scripts support this deployment:

```bash
npm start
npm run heroku-postbuild
```

`heroku-postbuild` installs client dependencies and builds `client/dist`. In production, Express serves `client/dist` after API routes and falls back to `client/dist/index.html` for non-API routes such as `/login`.

### Vercel Frontend + Heroku Backend

Use this when Vercel serves the React frontend and Heroku serves only the API.

Vercel environment variable:

```env
VITE_API_URL=https://YOUR_HEROKU_APP.herokuapp.com/api
```

Heroku config vars:

```env
MONGODB_URI=
CLIENT_URL=https://YOUR_VERCEL_APP.vercel.app
CORS_ALLOWED_ORIGINS=https://YOUR_VERCEL_APP.vercel.app
CORS_STRICT_ORIGINS=true
AUTH_USERNAME=
AUTH_PASSWORD=
JWT_SECRET=
JWT_EXPIRES_IN=1h
TRUST_PROXY=1
```

`CORS_ALLOWED_ORIGINS` is the explicit allowlist for the deployed frontend origin;
`CLIENT_URL` is also accepted. Set `CORS_STRICT_ORIGINS=true` so only those exact
origins are honoured.

## Scripts

```bash
npm run dev
npm run server
npm run client
npm test
npm run test:server
npm run test:client
npm run brain:update-brain
npm run brain:refresh-brain
npm run brain:good-morning
npm run brain:replan-day
npm run brain:generate-post
npm run brain:backfill-embeddings
npm run brain:smoke-test
```

## Operations

[docs/OPERATIONS.md](docs/OPERATIONS.md) covers backup expectations, Atlas index
recreation, embedding recovery, outage behaviour, log inspection, deployment
verification, rollback, known limitations, and the evidence required before
declaring AI retrieval production-ready.

## API

CRUD endpoints are available for:

- `/api/notes`
- `/api/tasks`
- `/api/deliverables`
- `/api/goals`
- `/api/projects`
- `/api/ideas`
- `/api/context`
- `/api/reviews`
- `/api/day-plans`
- `/api/brain-update-reports`
- `/api/generated-posts`

AI endpoint:

- `POST /api/chat`
- `GET /api/chat/conversations`
- `GET /api/chat/conversations/:id/messages`

Utility endpoints:

- `GET /api/health` — liveness. Never touches MongoDB or NVIDIA. A pass does not
  mean the deployment is production-ready.
- `GET /api/ready` — readiness. Reports MongoDB, rate-limit store, embedding
  queue, NVIDIA configuration presence, and Atlas vector capability. Returns
  `503` only when a required dependency (MongoDB) is down; optional AI services
  produce `degraded`. Exposes no credentials and makes no provider call.
- `GET /api/version`

`GET /api/version` returns app metadata for deployment verification:

```json
{
  "name": "brain",
  "version": "2.0.0",
  "environment": "production",
  "status": "ok",
  "timestamp": "2026-07-05T00:00:00.000Z"
}
```

Brain update reports support:

- `GET /api/brain-update-reports`
- `GET /api/brain-update-reports?status=success&from=2026-06-01&to=2026-06-30`
- `GET /api/brain-update-reports/:id`
- `POST /api/brain-update-reports`

Reports are read-only in the frontend. The list endpoint filters by `status`, `from`, and `to` using the report `runDate`.

Generated posts support:

- `GET /api/generated-posts`
- `GET /api/generated-posts/:id`

Post generation is Codex-command-driven via `npm run brain:generate-post`. The command executes the research/orchestrator/writer/reviewer workflow and persists immutable history records to MongoDB. The frontend is read-only for viewing saved generated posts and copying the LinkedIn post; it does not expose AI generation, create, update, or delete controls for generated posts.

Tasks and deliverables also support:

- `PATCH /api/tasks/:id/complete`
- `PATCH /api/tasks/:id/reopen`
- `PATCH /api/tasks/:id/archive`
- `PATCH /api/deliverables/:id/complete`
- `PATCH /api/deliverables/:id/reopen`
- `PATCH /api/deliverables/:id/archive`

Day plans support:

- `GET /api/day-plans/latest`
- `POST /api/day-plans/start`
- `POST /api/day-plans/restart`

`start` creates an active 8-hour session from the current runtime. `restart` marks the current active plan as restarted and creates a new active 8-hour session carrying forward only unfinished work.

## Brain Update Reports

The `update brain` Codex workflow updates brain data as before, then writes exactly one `BrainUpdateReport` document to MongoDB. The report captures the run status, summary, created and updated records, skipped items, linked tasks/projects, warnings, errors, next recommended actions, and metadata.

`update brain` is not a day-planning flow. It must not call `/api/day-plans/start`, `/api/day-plans/restart`, `startDaySession()`, or `restartDaySession()`, and it must not create or update `DayPlan` records. Day planning is handled only by dedicated day-planning commands such as `plan my day` or the day plan session endpoints.

## Refresh Brain

The `refresh brain` Codex workflow is a pipeline command for early-morning or ad hoc refreshes. It runs the same memory update behavior as `update brain` first, then refreshes today's active day plan with the latest MongoDB context. If an active `DayPlan` exists, it restarts that plan and carries forward unfinished work. If no active `DayPlan` exists, it creates a new active plan.

Use it when new notes or a brain dump should be reflected in today's tasks:

```bash
npm run brain:refresh-brain
```

This command can be run any time, including from Windows Task Scheduler at 6am. It does not change frontend behavior and does not expose AI API routes. `update brain` remains memory-only and never touches day plans; `refresh brain` is the separate workflow that updates memory first, then refreshes today's day plan.

## Project Execution Loop

Projects are stored in MongoDB and edited through the CRUD-only frontend. Codex CLI uses saved project data during planning and execution:

1. Capture the project problem statement and PRD.
2. Break the work into incomplete `nextActionableSteps`.
3. During daily planning, Codex reads active projects, prefers `focusToday: true`, ignores blocked/completed/production-ready projects, and converts selected steps into linked day tasks.
4. Codex executes from saved context such as `codexPrompt`, `summary`, `problemStatement`, `prd`, blockers, and `definitionOfDone`.
5. Completed Codex work leaves the project in `review_required`.
6. Manual review updates progress, summary, blockers, checklist items, and next steps.
7. The next day plan reads the updated project state and repeats the loop.

No frontend AI generation is part of this loop.
# Live Demo

[Live demo](https://brain-pi-black.vercel.app/)
