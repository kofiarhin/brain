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

Server `.env`:

```env
MONGODB_URI=
PORT=5000
CLIENT_URL=http://localhost:5173
AUTH_USERNAME=
AUTH_PASSWORD=
JWT_SECRET=
HUGGINGFACE_API_KEY=
HUGGINGFACE_MODEL=mistralai/Mistral-7B-Instruct-v0.3
HUGGINGFACE_API_URL=https://api-inference.huggingface.co/models
```

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
AUTH_USERNAME=
AUTH_PASSWORD=
JWT_SECRET=
HUGGINGFACE_API_KEY=
HUGGINGFACE_MODEL=mistralai/Mistral-7B-Instruct-v0.3
HUGGINGFACE_API_URL=https://api-inference.huggingface.co/models
```

Do not set `PORT`; Heroku provides it. Do not set `VITE_API_URL`; the production frontend defaults to `/api` on the same Heroku app.

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
AUTH_USERNAME=
AUTH_PASSWORD=
JWT_SECRET=
```

`CLIENT_URL` controls CORS for the deployed frontend origin.

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
```

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

- `GET /api/health`
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

