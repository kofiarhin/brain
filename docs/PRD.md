# Brain OS v2 Product Requirements

## Status

This document describes the product behavior evidenced by the current repository documentation and package manifest. It separates implemented behavior from future possibilities.

## Product summary

Brain OS v2 is a personal operating system that stores durable personal and project context in MongoDB, exposes CRUD workflows through a React interface, and uses Codex CLI commands as the AI-assisted reasoning and update layer.

## Problem

Personal notes, tasks, goals, projects, reviews, plans, ideas, and generated outputs often become fragmented across tools and lose the context needed for daily planning and project execution. Brain provides one durable data store and a controlled workflow for turning that context into actionable plans and reviewable outputs.

## Primary user

The current product is designed as a single-user personal system. Authentication protects the application UI and API. Multi-user tenancy, teams, public collaboration, and role-based permissions are not documented as implemented.

## Product goals

- Store durable personal operating-system data in MongoDB.
- Provide a CRUD-focused web interface for viewing and maintaining records.
- Support AI-assisted workflows through explicit Codex CLI commands rather than unrestricted autonomous writes.
- Generate and maintain day plans from saved context.
- Preserve reviewable history for brain updates and generated posts.
- Keep conversational chat read-only unless write behavior is explicitly introduced later.

## Implemented domains

The API and frontend support records for:

- notes;
- tasks;
- deliverables;
- goals;
- projects;
- ideas;
- context;
- reviews;
- day plans;
- brain update reports;
- generated posts.

## Implemented workflows

### CRUD management

Users create, read, update, complete, reopen, archive, and inspect supported records through the authenticated application.

### Read-only chat

The authenticated `/api/chat` surface provides conversational access to saved Brain context. It does not provide general write access to Brain records.

### Update brain

The `brain:update-brain` workflow updates memory records and writes exactly one Brain Update Report. It must not start, restart, create, or modify day plans.

### Refresh brain

The `brain:refresh-brain` workflow updates memory first, then refreshes the current day plan. It restarts an active plan while carrying forward unfinished work, or creates a new active plan when none exists.

### Day planning

Day-plan endpoints can start or restart an eight-hour active session. Restarting carries forward only unfinished work.

### Generated posts

The `brain:generate-post` command performs the research, orchestration, writing, and review workflow, then stores immutable generated-post history. The frontend is read-only for these records.

### Project execution loop

Projects store problem statements, PRDs, next actions, blockers, definitions of done, prompts, summaries, and progress. Codex reads that context during planning and execution, while completed work returns to manual review before the next cycle.

## Non-goals in the current implementation

- Autonomous frontend AI writes.
- Multi-user collaboration.
- General-purpose agent execution through the chat route.
- Automatic approval of project completion.
- Treating day planning and memory refresh as the same workflow.

## Functional requirements

- All protected application routes require valid authentication.
- MongoDB remains the source of truth for supported records.
- CRUD operations preserve domain validation and lifecycle semantics.
- Chat remains read-only with respect to durable Brain data.
- Brain Update Reports record one outcome per update-brain run.
- Generated posts preserve immutable history.
- Day-plan restart behavior carries forward unfinished work only.
- Project execution leaves completed Codex work in a review-required state.

## Quality requirements

- Europe/London day calculations remain consistent across planning and dashboard behavior.
- Loading, error, empty, and structured-data states render clearly.
- Server and client tests cover critical workflows.
- Secrets remain in environment configuration and are not committed.
- Deployment metadata is available through the version endpoint.

## Success criteria

The product is successful when the user can reliably capture context, manage active work, generate a daily plan, run explicit AI-assisted workflows, review the resulting changes and reports, and return the system to a consistent state without hidden autonomous writes.

## Open product questions

- Which workflow is the immediate product priority?
- Which data belongs in Brain versus the Ideas Hub or Context API?
- Should chat ever gain scoped write operations?
- What backup, export, restore, and retention guarantees are required?
- Which production deployment topology is authoritative?
