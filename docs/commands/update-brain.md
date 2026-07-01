# update brain

## Purpose

Maintain long-term memory from raw notes and current database context, then create exactly one `BrainUpdateReport`.

## Allowed Reads

All memory collections.

## Allowed Writes

Projects, goals, ideas, context items, tasks, deliverables, reviews, and exactly one brain update report.

## Forbidden Writes

`DayPlans`.

## Input Context

Raw notes, existing long-term memory, tasks, reviews, preferences, prior day plans, and previous brain update reports.

## Output Contract

Structured JSON with command status, report id, created/updated/skipped counts, warnings, and errors.

## Failure Behaviour

If memory processing partially fails, still write one report with `partial` or `failed` status and captured errors where possible.

## Edge Cases

- Snapshot `DayPlan` count before processing.
- Verify `DayPlan` count is unchanged before report creation.
- Preserve raw notes.
- Skip unclear notes instead of inventing facts.
- Never generate tomorrow's plan, schedule work, or create day plans.

## Test Checklist

- Creates exactly one brain update report.
- Creates zero day plans.
- Preserves raw notes.
- Captures skipped ambiguous notes.
