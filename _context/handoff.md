# Brain Project — AI Handoff

> **Read this document completely before making any changes to the repository.**

---

# Project Overview

Brain is **not a chatbot**.

Brain is a **Personal AI Operating System** designed to manage my life, projects, goals, tasks, memory, planning, and execution.

The application follows a strict separation of responsibilities:

- **React** is only a user interface.
- **Express + MongoDB** manage persistence and orchestration.
- **Codex** performs reasoning.

---

# Core Architecture

The system is intentionally divided into three layers.

## 1. React (Presentation Layer)

Responsibilities:

- CRUD operations
- Dashboards
- Forms
- Reports
- Displaying data

React **must never** contain:

- AI reasoning
- Planning logic
- Prioritization
- Decision making

---

## 2. Express + MongoDB (Application Layer)

Responsibilities:

- APIs
- Validation
- Persistence
- Business logic
- Command orchestration

This layer owns the application's behavior and coordinates execution.

---

## 3. Codex (Reasoning Layer)

Codex is the project's reasoning engine.

It is responsible for:

- Planning
- Prioritization
- Memory organization
- Project analysis
- Long-term knowledge updates

The backend provides structured context.

Codex decides what to do.

---

# Locked Brain MVP Workflows

The MVP intentionally exposes only three AI workflows.

---

## 1. Good Morning

Purpose:

Generate today's execution plan.

Responsibilities:

- Archive the previous active DayPlan
- Create exactly one active DayPlan
- Generate/update today's Tasks
- Schedule work
- Respect planning preferences

Planning context includes:

- Tasks
- Projects
- Goals
- Deliverables
- Preferences
- Context
- Previous DayPlans
- Latest BrainUpdateReport

---

## 2. Replan Day

Purpose:

Rebuild today's execution plan based on the current state.

Responsibilities:

- Require an active DayPlan
- Restart the current DayPlan
- Create one replacement DayPlan
- Preserve completed work
- Avoid duplicate carry-forward tasks

---

## 3. Update Brain

Purpose:

Maintain long-term memory.

Responsibilities:

- Read Notes
- Organize knowledge
- Update memory collections
- Produce exactly one BrainUpdateReport

It must **never**:

- Create DayPlans
- Modify DayPlans
- Restart DayPlans
- Archive DayPlans
- Schedule work
- Generate today's tasks

---

# Architectural Rules

The following rules are considered invariant.

## DayPlans

- Exactly one active DayPlan may exist.
- `good morning` creates today's DayPlan.
- `replan day` replaces today's DayPlan.
- `update brain` must never mutate DayPlans.

---

## Projects

Planning workflows may read Projects but must never modify them.

---

## Goals

Planning workflows may read Goals but must never modify them.

---

## Tasks

Planning commands may:

- Create Tasks
- Update Tasks

Planning commands should never mutate unrelated collections.

---

# Current Implementation Status

The `dev` branch now includes the Brain MVP command architecture.

---

## Command Layer

```
server/services/commands/
```

Contains:

- commandContext.js
- commandGuards.js
- commandReports.js
- commandValidation.js
- goodMorning.js
- replanDay.js
- updateBrain.js

---

## Command Scripts

```
server/scripts/
```

Contains:

- goodMorning.js
- replanDay.js
- updateBrain.js

Available npm commands:

```bash
npm run brain:good-morning
npm run brain:replan-day
npm run brain:update-brain
```

---

## Planning Improvements

Planning now reads:

- Active Goals
- Latest BrainUpdateReport
- Preferences
- Context
- Previous DayPlans
- Open Deliverables

Project filtering ignores:

- inactive
- completed
- abandoned
- archived
- blocked
- ready_for_production

Task filtering ignores:

- closed
- complete
- completed
- dismissed
- archived
- converted

Duplicate scheduled tasks are prevented using:

- normalized task title
- London date

Planning respects:

```
Preference.planning.maxDailyTasks
```

---

## Guardrails

Implemented protections include:

- Single active DayPlan validation
- DayPlan count validation
- DayPlan snapshot validation
- Structured command validation
- Structured command reports

`updateBrain` verifies that DayPlans remain unchanged throughout execution.

---

## Tests

A comprehensive Jest suite now covers:

- Good Morning
- Replan Day
- Update Brain
- Duplicate task prevention
- Project filtering
- Task filtering
- DayPlan protection
- maxDailyTasks enforcement
- Command script execution

---

# Current Architecture Assessment

The implementation is now closely aligned with the MVP PRD.

The repository now has:

- A dedicated command layer
- Clear command boundaries
- Backend-owned planning
- CRUD-only frontend
- Guardrails protecting planning data
- Automated tests for core behavior

Overall, the architecture is considered production-ready for the MVP.

---

# Known Improvement Area

The current implementation of `updateBrain` classifies Notes using keyword heuristics.

Examples include words like:

- goal
- project
- task
- idea

This approach is acceptable for the MVP.

Future improvements should replace this heuristic with AI-driven reasoning while preserving the existing command boundaries.

Any future implementation must continue to:

- Protect DayPlans
- Produce a BrainUpdateReport
- Avoid scheduling work
- Avoid creating today's tasks

---

# Context Preservation

The repository contains accumulated planning knowledge.

Treat the following files carefully:

```
_context/
notes.txt
README.md
```

Do not overwrite historical context unless explicitly instructed.

If large architectural changes are made:

- Preserve historical context
- Archive previous summaries when appropriate
- Avoid replacing accumulated project knowledge

---

# Working Principles

Before making changes:

1. Inspect the existing implementation.
2. Understand the current architecture.
3. Make the smallest change that solves the problem.
4. Preserve command boundaries.
5. Keep business logic inside services.
6. Keep React free of AI reasoning.
7. Add or update tests when behavior changes.
8. Avoid unrelated refactors.

---

# Non-Goals

Do **not** introduce:

- AI chat routes
- Browser-side planning
- OAuth
- Clerk
- Auth0
- Multi-user architecture
- Billing
- Plugins
- Mobile-specific architecture
- Unrelated framework migrations

---

# Definition of Success

Any future contribution should satisfy the following principles:

1. Preserve the three-command architecture.
2. Keep planning deterministic and testable.
3. Maintain exactly one active DayPlan.
4. Ensure `updateBrain` never mutates planning data.
5. Keep React as a presentation layer.
6. Preserve accumulated project knowledge.
7. Leave the codebase cleaner and more maintainable than it was found.
