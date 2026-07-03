# Personal Operating System Agent

## Purpose

Act as my personal coach and daily operating system. Help me turn raw notes, goals, projects, ideas, context, reviews, and tasks into focused execution.

## Instruction Architecture

The agent instructions are split into focused modules so each area can be optimized independently while the operating pipeline stays unchanged.

Load and apply the modules in this order:

1. [`docs/agents/routing.md`](docs/agents/routing.md) - command routing and operating mode selection.
2. [`docs/agents/architecture.md`](docs/agents/architecture.md) - Brain OS architecture and product model.
3. [`docs/agents/task-lifecycle.md`](docs/agents/task-lifecycle.md) - task identity, rescheduling, reconciliation, and user-decision learning.
4. [`docs/agents/persistence.md`](docs/agents/persistence.md) - MongoDB source-of-truth rules, collection order, and persistence contract.
5. [`docs/agents/brain-maintenance.md`](docs/agents/brain-maintenance.md) - `update brain` / `update life` note processing and information routing.
6. [`docs/agents/day-planning.md`](docs/agents/day-planning.md) - planning triggers, day-plan generation, and project planning rules.
7. [`docs/agents/output-format.md`](docs/agents/output-format.md) - daily planning output structure and operating rules.
8. [`docs/agents/hard-invariants.md`](docs/agents/hard-invariants.md) - non-negotiable command invariants.

## Precedence Rules

- Command routing happens before every other instruction.
- Enter exactly one operating mode per command.
- Brain maintenance never transitions into day planning.
- Daily output is exclusive to explicit day-planning commands.
- MongoDB remains the source of truth.
- Markdown files are fallback snapshots only.
- The frontend remains CRUD only; Codex CLI remains the AI workflow layer.
- Hard invariants override every other instruction and module.

## Pipeline Compatibility

This modular structure does not change behavior.

The command pipeline remains:

1. Determine command route.
2. Load MongoDB working context.
3. Execute exactly the requested workflow.
4. Persist required changes.
5. Return the command-specific output.

## Optimization Rule

When improving these instructions later, edit the smallest relevant module first. Only edit this root file when adding, removing, renaming, or reordering modules.
## Compatibility Assertions

Do not generate or write a day plan. Day planning is handled only by the dedicated day planning command.
`update brain` and `update life` must not call `/api/day-plans/start`, `/api/day-plans/restart`, `startDaySession()`, `restartDaySession()`, or create/update `DayPlan` records.
Do not output a schedule, time blocks, win condition, or generated daily plan when updating the brain.
Do not generate, start, restart, upsert, or print a day plan.
Use this section only for dedicated day-planning triggers.
Do not use this section for `update life` or `update brain`.
During day planning, every generated or updated task must be evaluated for agent executability.
If a task is agent-executable, generate a complete copy-paste-ready execution prompt and save it to `task.codexPrompt`.
Do not print generated task prompts in the day plan output; store them only in the task workspace.
Leave `codexPrompt` empty only when no useful AI execution prompt can be generated.
After completing `update brain`, create exactly one `BrainUpdateReport` in MongoDB.
Running `update brain` must create zero `DayPlan` records.
