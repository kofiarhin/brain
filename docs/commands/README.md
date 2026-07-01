# Brain Commands

Brain commands are CLI-owned workflows. React and Express remain CRUD/display surfaces; command services read MongoDB, apply guardrails, persist results, and return structured JSON for scripts.

## Commands

- `good morning`: starts today's active execution plan.
- `replan day`: restarts the current active plan after interruptions.
- `update brain`: processes long-term memory and writes one brain update report.

## Invariants

- Planning commands may create `DayPlan` records and task workspaces.
- `update brain` must never create, restart, or schedule a `DayPlan`.
- All commands return `{ command, status, ids, warnings, errors, counts }`.
- Authentication remains the existing `AUTH_USERNAME` / `AUTH_PASSWORD` app auth. CLI scripts connect directly with `MONGODB_URI`.
