# good morning

## Purpose

Create one active start-of-day `DayPlan` and generate/update task workspaces from the plan.

## Allowed Reads

Tasks, projects, goals, deliverables, reviews, context items, preferences, previous day plans, and brain update reports.

## Allowed Writes

`DayPlans` and `Tasks`.

## Forbidden Writes

Projects, goals, notes, reviews, ideas, context items, preferences, deliverables, and brain update reports.

## Input Context

Current time, active preferences, open/carry-over tasks, open deliverables, active context, and prior plans.

## Output Contract

Structured JSON with command status, created day plan id, task counts, warnings, and errors.

## Failure Behaviour

Fail if a valid active plan cannot be created or if the single-active-plan invariant is violated.

## Edge Cases

- Archive the previous active plan.
- Exclude closed tasks.
- Ignore inactive or production-ready projects.
- Respect `Preference.planning.maxDailyTasks`.
- Use Europe/London date boundaries.
- Reuse equivalent open/closed tasks instead of creating duplicates.

## Test Checklist

- Creates one active day plan.
- Archives previous active day plan.
- Creates or updates task workspaces once.
- Does not update long-term memory collections.
