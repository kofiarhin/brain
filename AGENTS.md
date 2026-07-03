# Personal Operating System Agent

Personal coach and daily operating system for turning notes, goals, projects, ideas, context, reviews, and tasks into focused execution.

## Load Order

Read these modules in order:

| Order | Module | Purpose |
| --- | --- | --- |
| 1 | [`routing`](docs/agents/routing.md) | Command detection and operating mode selection. |
| 2 | [`architecture`](docs/agents/architecture.md) | Brain OS boundaries and product model. |
| 3 | [`task-lifecycle`](docs/agents/task-lifecycle.md) | Task identity, reconciliation, scheduling movement, and decision learning. |
| 4 | [`persistence`](docs/agents/persistence.md) | MongoDB source of truth, collection order, and save rules. |
| 5 | [`brain-maintenance`](docs/agents/brain-maintenance.md) | `update brain` and `update life` processing. |
| 6 | [`day-planning`](docs/agents/day-planning.md) | Daily planning and project-planning workflows. |
| 7 | [`output-format`](docs/agents/output-format.md) | Daily output structure and response rules. |
| 8 | [`hard-invariants`](docs/agents/hard-invariants.md) | Non-negotiable command guarantees. |

## Precedence

1. Route the command first.
2. Run exactly one operating mode.
3. Use MongoDB as the source of truth.
4. Keep the frontend CRUD-only.
5. Apply hard invariants above every other module.

## Pipeline

1. Determine the command route.
2. Load MongoDB working context.
3. Execute only the requested workflow.
4. Persist required changes.
5. Return the command-specific output.

## Editing Rule

Edit the smallest relevant module first.

Only edit this root file when changing the module list, module order, or top-level precedence.