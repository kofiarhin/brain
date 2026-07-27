# Brain OS v2 Technical Specification

## Status

This specification documents the architecture evidenced by the current repository and README. It is descriptive, not a proposal to expand the system.

## Runtime and stack

- Node.js 22.x
- Express 4
- MongoDB with Mongoose
- React client built with Vite
- Jest and Supertest for server tests
- Client-side tests through the client package
- Codex CLI commands for AI-assisted workflows
- Optional Hugging Face inference for read-only chat

## System boundaries

### React client

The client is the authenticated CRUD and viewing interface. It uses `/api` by default and can be pointed at a separate backend with `VITE_API_URL`. In local Vite development, `/api` is proxied to the Express server.

### Express API

The server exposes authentication, CRUD resources, day-plan operations, report/history reads, chat, health, and version metadata. In a single-app production deployment it also serves the built React application.

### MongoDB

MongoDB is the durable source of truth for application records. Mongoose models and services implement domain persistence and lifecycle behavior.

### Codex command layer

Codex-triggered scripts run explicit AI-assisted workflows. They read and write through application services or APIs, produce durable reports or generated records, and remain separate from the browser CRUD interface.

### Read-only chat

The `/api/chat` route can read saved application context and persist conversation history, but it is not a general write channel for Brain records.

## Major data domains

- Note
- Task
- Deliverable
- Goal
- Project
- Idea
- Context
- Review
- DayPlan
- BrainUpdateReport
- GeneratedPost
- Chat conversation and message records

Exact schemas remain authoritative in the Mongoose model files.

## Authentication and security

The documented deployment requires `AUTH_USERNAME`, `AUTH_PASSWORD`, and `JWT_SECRET`. Protected routes should reject unauthenticated requests. CORS is controlled through `CLIENT_URL`. Hugging Face credentials and MongoDB connection strings must remain environment secrets.

The current architecture is single-user. It does not document tenant isolation, role-based authorization, or per-record ownership.

## Key workflows

### Update brain

1. Read current MongoDB context.
2. Apply memory-focused updates.
3. Write exactly one Brain Update Report.
4. Do not call day-plan start or restart operations.

### Refresh brain

1. Run the memory-update behavior.
2. Inspect today's active DayPlan.
3. Restart it while carrying forward unfinished work, or create a new active plan.
4. Persist the resulting report and plan state.

### Day-plan lifecycle

- `start` creates a new active eight-hour session.
- `restart` marks the active plan restarted and creates a replacement containing unfinished work.
- Dashboard calculations use Europe/London day semantics.

### Generated-post pipeline

The command coordinates research, orchestration, drafting, review, and persistence. GeneratedPost records are presented as immutable history in the client.

### Project execution

Saved project context drives daily planning and Codex execution. Completed agent work transitions to `review_required`, after which manual review updates project state and next actions.

## Deployment models

### Heroku single application

Express serves the API and `client/dist`. `heroku-postbuild` installs and builds the client. The frontend uses same-origin `/api`.

### Vercel frontend and Heroku backend

Vercel hosts the built client and sets `VITE_API_URL` to the Heroku `/api` endpoint. Heroku configures CORS through `CLIENT_URL`.

The repository documentation currently presents both models; production records should identify which deployment is authoritative.

## Verification

Root verification runs server tests followed by client tests:

```bash
npm test
```

Additional release checks should include:

- production client build;
- health and version endpoint checks;
- authentication checks;
- CRUD lifecycle checks;
- update-brain isolation from day planning;
- refresh-brain plan behavior;
- Europe/London date behavior;
- deployment smoke tests.

## Known architectural risks

- Single-user credentials do not scale to multi-user use.
- AI command workflows and CRUD routes can drift if they bypass shared services.
- Two deployment topologies increase configuration drift risk.
- External inference availability can affect chat while CRUD should remain usable.
- Data backup, recovery, retention, and migration procedures are not fully specified.
- MongoDB content crosses multiple personal and project domains and requires careful privacy handling.

## Documentation maintenance

When source behavior changes, update this specification, the PRD, the root README, and relevant tests in the same verified change. Planned behavior must not be described as implemented.