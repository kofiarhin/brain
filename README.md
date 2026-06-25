# Brain OS v2

A full-stack MERN Personal Operating System where MongoDB is memory, Codex CLI is the brain, and React is the interface.

## Architecture

- **Frontend:** CRUD only. Saves data, retrieves data, and displays generated data.
- **MongoDB:** Source of truth for notes, tasks, plans, reviews, goals, projects, ideas, context, and deliverables.
- **Codex CLI:** AI layer. Run commands such as `update life`, `update brain`, `plan my day`, and `morning briefing` manually from Codex. Codex reads MongoDB, reasons over the data, and writes updates back to MongoDB.

The application does **not** expose AI routes such as `/api/update-life`, `/api/plan-day`, or `/api/brain/*`.

## Setup

```bash
cp .env.example .env
npm run install:all
npm run dev
```

## Environment

```env
MONGODB_URI=
PORT=5000
CLIENT_URL=http://localhost:5173
```

For the client, set `VITE_API_URL` when the API is not available at `http://localhost:5000/api`.

## Scripts

```bash
npm run dev
npm run server
npm run client
npm test
npm run test:server
npm run test:client
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

Tasks and deliverables also support:

- `PATCH /api/tasks/:id/complete`
- `PATCH /api/tasks/:id/reopen`
- `PATCH /api/tasks/:id/archive`
- `PATCH /api/deliverables/:id/complete`
- `PATCH /api/deliverables/:id/reopen`
- `PATCH /api/deliverables/:id/archive`

Day plans support:

- `GET /api/day-plans/latest`

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