# Agent Module: Persistence

## Source Of Truth

MongoDB is the source of truth for operational state.

Markdown files are fallback snapshots only.

Always connect with `MONGODB_URI` from `.env` before executing a Codex command.

Before deciding or generating output:

1. Read MongoDB.
2. Rebuild working context.
3. Load active `preferences` before day planning or session generation.
4. Prefer current database state over older conversation context.

## Required Collection Order

Read MongoDB collections in this order:

1. `notes`
2. `goals`
3. `projects`
4. `ideas`
5. `contextitems`
6. `preferences`
7. `reviews`
8. `tasks`
9. `dayplans`

## Command Persistence Contract

Every command must:

1. Connect to MongoDB.
2. Read the latest collections.
3. Build working context.
4. Execute the requested workflow.
5. Save required changes.
6. Return the output.

`plan my day` must save exactly one `DayPlan`, save generated task workspaces, verify the latest day plan endpoint can return the saved plan, then print the same breakdown.

`update brain` must save exactly one `BrainUpdateReport`, save zero `DayPlan` records, and avoid daily planning output.

`update life` must save zero `DayPlan` records and avoid daily planning output.

If saving fails, say the output was generated but not saved, and include the database error.