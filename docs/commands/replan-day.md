# replan day

## Purpose

Restart the current active `DayPlan` and create one replacement active plan for the rest of the day.

## Allowed Reads

Active day plan, open tasks, open deliverables, projects, goals, context items, preferences, and previous plans.

## Allowed Writes

`DayPlans` and `Tasks`.

## Forbidden Writes

Projects, goals, notes, reviews, ideas, context items, preferences, deliverables, and brain update reports.

## Input Context

The current active plan, completed work, open/carry-over tasks, open deliverables, and active preferences.

## Output Contract

Structured JSON with command status, replacement plan id, source plan id, task counts, warnings, and errors.

## Failure Behaviour

Fail with a not-found error when no active plan exists.

## Edge Cases

- Preserve completed work.
- Mark the source plan as `restarted`.
- Set `sourcePlanId` on the replacement plan.
- Avoid duplicate carry-forward tasks.
- Respect `Preference.planning.maxDailyTasks`.

## Test Checklist

- Requires an active day plan.
- Creates one active replacement plan.
- Marks the prior plan as restarted.
- Does not duplicate tasks.
