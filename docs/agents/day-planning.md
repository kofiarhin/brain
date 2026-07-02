# Agent Module: Day Planning

## Planning Triggers

Planning occurs only when the user intentionally invokes one of these exact planning commands:

- `plan my day`
- `start day`
- `restart day`
- `morning briefing`
- `daily plan`
- `optimize today`
- `what should I focus on`
- `good morning`

For those commands:

1. Read MongoDB sources of truth, including recent raw notes.
2. Load the active `preferences` document and apply it to scheduling, capacity, output, and agent behavior decisions.
3. Load open tasks scheduled for today, open overdue tasks scheduled before today, and postponed tasks whose scheduled date is today.
4. Treat that scheduled and overdue work as carry-over context before proposing new work.
5. Estimate today's available capacity using active preferences and existing planning conventions.
6. Fill the day with carry-over work first unless preferences explicitly say otherwise.
7. Create new tasks only when capacity remains or I explicitly request additional work.
8. If capacity is exceeded, recommend postponing lower-priority existing tasks instead of overloading the day.
9. Determine current priorities and unfinished next actions.
10. Surface commitments, follow-ups, and neglected open loops.
11. Align the day with long-term goals.
12. Favor high-impact execution over research, planning, or busy work unless preferences indicate otherwise.
13. Reduce context switching and define measurable task outcomes.
14. Save the generated plan and rich task workspaces to MongoDB before returning the console breakdown.
15. Put missing or contradictory information under `Unclear Items`.

## Codex CLI Project Planning Contract

When planning project execution:

1. Read active projects from MongoDB.
2. Prefer projects where `focusToday: true`.
3. Ignore projects with `executionState` of `blocked`, `completed`, or `ready_for_production`.
4. Pull incomplete `nextActionableSteps`.
5. Reconcile selected steps against existing open and carry-over tasks before creating task workspaces.
6. Convert selected actionable steps into rich day task workspaces in the `tasks` collection only when no equivalent open task already exists.
7. Link generated tasks back to the project with `projectId` and, when available, `projectActionId`.
8. Use `codexPrompt`, `summary`, `problemStatement`, `prd`, `blockers`, and `definitionOfDone` as execution context inside the task workspace.
9. For each generated or updated task workspace, generate `codexPrompt` when an AI agent could reasonably produce a meaningful first draft, implementation, analysis, or completed output.
10. Preserve an existing `codexPrompt` when updating a task unless it is empty or clearly stale for the new task objective.
11. After Codex work is complete, leave the project in `review_required` until I manually update progress, summary, blockers, and next steps.

The frontend remains CRUD only. It can edit project state, actionable steps, checklists, and progress history, but it must not generate plans, assign work, call OpenAI, or run project execution workflows.