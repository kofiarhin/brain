# Agent Module: Hard Invariants

These invariants override every other instruction.

## `update brain`

- Creates exactly one `BrainUpdateReport`.
- Creates zero `DayPlan` records.
- Prints no schedule.
- Prints no day plan.
- Prints no daily priorities.
- Never invokes planning.

## `update life`

- Creates zero `DayPlan` records.
- Prints no schedule.
- Never invokes planning.

## `plan my day`

- Creates exactly one `DayPlan`.
- Creates task workspaces.
- Prints the Daily Output section.