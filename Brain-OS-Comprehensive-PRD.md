
# Brain OS v2 – Comprehensive Product Requirements Document (PRD)

**Version:** 1.1
**Status:** Living document / Source of Truth  
**Derived From:** Current repository implementation (`brain`)  
**Last Updated:** 2026-06-26

---

# 1. Executive Summary

Brain OS v2 is a personal operating system built on the MERN stack that centralizes an individual's knowledge, planning, execution, and reflection workflows.

The product treats:

- **MongoDB** as persistent memory
- **React** as the user interface
- **Codex CLI / external AI tooling** as the reasoning layer
- **Express APIs** as CRUD infrastructure

The application intentionally avoids embedding AI orchestration into the web application itself. The web product acts primarily as a structured knowledge system and operational dashboard.

---

# 2. Product Vision

Provide a single system where a user can:

1. Capture information.
2. Organize projects and goals.
3. Plan daily work.
4. Track execution.
5. Review progress.
6. Enable external AI agents to reason over structured personal data.

---

# 3. Product Principles

- Local-first thinking with cloud persistence.
- Structured data over unstructured notes.
- CRUD-first architecture.
- AI augmentation without coupling AI to the frontend.
- Simple interfaces optimized for speed.

---

# 4. Target Users

## Primary User
Knowledge workers, developers, founders, creators, and operators who need a personal operating system.

## Secondary Users
- Productivity enthusiasts
- Solo entrepreneurs
- Consultants
- Content creators

---

# 5. Core Use Cases

## Capture
- Store notes
- Save ideas
- Preserve context

## Planning
- Create goals
- Define projects
- Build day plans

## Execution
- Manage tasks
- Track deliverables
- Mark completion

## Reflection
- Create reviews
- Review progress over time

## AI Augmentation
External tools read/write data to generate:
- Morning briefings
- Daily plans
- Life updates
- Strategic recommendations

---

# 6. Product Scope

## In Scope

### Notes
Personal notes and knowledge storage.

### Tasks
Actionable work items with lifecycle states.

### Deliverables
Track outputs and shipped work.

### Goals
Long-term objectives.

### Projects
Containers for work initiatives.

### Ideas
Future concepts and opportunities.

### Context
Reference information and background knowledge.

### Reviews
Retrospectives and reflection entries.

### Day Plans
Dynamic execution sessions. A plan is no longer tied to a fixed 04:00 start or a single plan per London calendar day. Day planning is session-based and can be started or restarted whenever the user begins an execution block.

---

## Out of Scope

- Authentication
- Multi-user collaboration
- Embedded AI endpoints
- Notifications
- Permissions and roles
- File storage
- Real-time collaboration
- Team workspaces
- Billing and subscriptions

---

# 7. Functional Requirements

## 7.1 Notes Module

### Users can:
- Create notes
- Edit notes
- Delete notes
- Browse notes

### Acceptance Criteria
- Notes persist in MongoDB.
- CRUD endpoints exist.
- Notes are available via frontend pages.

---

## 7.2 Tasks Module

### Users can:
- Create tasks
- Update tasks
- Delete tasks
- Complete tasks
- Reopen tasks
- Archive tasks

### Acceptance Criteria
- State transitions are persisted.
- Archived tasks remain stored.

---

## 7.3 Deliverables Module

### Users can:
- Create deliverables
- Complete deliverables
- Reopen deliverables
- Archive deliverables

---

## 7.4 Goals Module

### Users can:
- Create goals
- Update goals
- Remove goals
- Review goals

---

## 7.5 Projects Module

### Users can:
- Create projects
- Organize work initiatives
- Edit project metadata
- Remove projects

---

## 7.6 Ideas Module

### Users can:
- Capture ideas
- Maintain an idea backlog

---

## 7.7 Context Module

### Users can:
- Store contextual information
- Maintain persistent memory

---

## 7.8 Reviews Module

### Users can:
- Record retrospectives
- Track lessons learned

---

## 7.9 Day Planning Module

### Users can:
- Start a new day planning session at the current runtime.
- Restart the current active planning session from the current runtime.
- Retrieve the latest active plan.
- Maintain historical plans, including restarted sessions.
- Review the active plan window, status, and session type in the frontend.

### Session Rules
- `start day` creates a brand-new active session.
- `restart day` rebuilds the current active session.
- `startTime` is the command runtime.
- `endTime` is exactly 8 hours after `startTime`.
- Planning does not depend on a fixed 04:00 schedule.
- Multiple sessions may exist on the same `londonDate`.
- `londonDate` remains for grouping and display only.
- Sessions may cross midnight and still remain valid.

### Context Filtering
When starting or restarting a session, the system must inspect:
- Tasks
- Deliverables
- Prior day plans
- Context entries, when available

The generated session should include:
- Incomplete must-do items.
- Unfinished priorities.
- Active tasks.
- Incomplete deliverables.
- Relevant context.

The generated session must exclude:
- Completed tasks.
- Completed deliverables.
- Archived work.
- Work recorded as completed or accomplished in the prior active session.

### Restart Behavior
- A restart must find the current active plan.
- The previous active plan must be marked `restarted` or safely replaced while preserving history.
- The new plan must set `sessionType` to `restart`.
- The new plan must link back to the previous plan with `sourcePlanId`.
- Only unfinished, active, relevant work is carried forward.
- Completed work must not be reintroduced.

### Acceptance Criteria
- Running `start day` at any time creates an active 8-hour session from that exact runtime.
- Running `restart day` creates a new active 8-hour session from the current runtime.
- Completed/accomplished work is not reintroduced after restart.
- Multiple plans can exist on the same London calendar date.
- Midnight and cross-day sessions work.
- Existing legacy day plans render and can still be retrieved.

---

# 8. User Journeys

## Morning Workflow

1. Open dashboard.
2. Start or review the latest active day planning session.
3. Review tasks and deliverables.
4. Execute priorities.

---

## Session Restart Workflow

1. Complete or abandon part of the active session.
2. Run `restart day`.
3. System reads the current active plan, tasks, deliverables, prior plans, and context.
4. System marks the previous active plan as restarted.
5. System creates a new active 8-hour session from the current runtime.
6. User executes only unfinished, relevant work.

---

## Project Workflow

1. Create project.
2. Define goals.
3. Add tasks.
4. Deliver outputs.
5. Review progress.

---

## Reflection Workflow

1. Complete work.
2. Create review.
3. Capture lessons.
4. Feed information into future planning.

---

# 9. System Architecture

## Frontend

### Technology
- React
- Vite
- Tailwind CSS
- React Router
- Vitest

### Pages

- Dashboard
- Notes
- Tasks
- Deliverables
- Projects
- Goals & Ideas
- Context
- Reviews
- Day Plan
- Entity View

### Components

- Card
- List
- App Layout

---

## Backend

### Technology
- Node.js
- Express
- MongoDB
- Mongoose
- Jest

### Architecture

Controller Pattern:
- Generic CRUD controller
- Resource-specific routes

### API Resources

- /api/notes
- /api/tasks
- /api/deliverables
- /api/goals
- /api/projects
- /api/ideas
- /api/context
- /api/reviews
- /api/day-plans

---

# 10. Domain Model

## Note
Represents knowledge.

## Task
Represents actionable work.

States:
- Active
- Completed
- Archived

## Deliverable
Represents produced outputs.

States:
- Active
- Completed
- Archived

## Goal
Represents desired outcomes.

## Project
Represents initiatives and bodies of work.

## Idea
Represents opportunities and future concepts.

## Context
Represents supporting information and memory.

## Review
Represents reflection and learning.

## Day Plan
Represents a dynamic execution planning session.

Fields:
- `date`: Date used by legacy plans and fallback sorting.
- `londonDate`: London calendar date used for grouping/display only.
- `startTime`: Session start timestamp.
- `endTime`: Session end timestamp, exactly 8 hours after `startTime`.
- `status`: `active`, `completed`, `restarted`, or `archived`.
- `sessionType`: `start` or `restart`.
- `sourcePlanId`: Previous active plan when the session is a restart.
- `completedItems`: Work known to be completed/accomplished and excluded from restart planning.
- `carriedForwardItems`: Unfinished active work carried into the current session.
- `focus`: Primary focus statement.
- `priorities`: Top priorities.
- `schedule`: Session schedule entries.
- `mustDo`: Highest priority work.
- `shouldDo`: Secondary work.
- `niceToHave`: Optional work.
- `forgotten`: Possible open loops.
- `deliverables`: Expected outputs.
- `winCondition`: Criteria for a successful session.
- `insight`: Planning insight.
- `motivationalPost`: Motivational message and quotes.
- `unclearItems`: Missing or contradictory information.

---

# 11. API Requirements

All resources support:

- Create
- Read
- Update
- Delete

Additional endpoints:

## Tasks

PATCH:
- complete
- reopen
- archive

## Deliverables

PATCH:
- complete
- reopen
- archive

## Day Plans

GET:
- latest

POST:
- start
- restart

### Day Plan API Behavior
- `POST /api/day-plans/start` creates a new active 8-hour planning session.
- `POST /api/day-plans/restart` marks the current active plan as `restarted` and creates a new active 8-hour planning session.
- `GET /api/day-plans/latest` returns the latest active plan first. If no active plan exists, it returns the most recent plan.
- Existing CRUD routes continue to work.
- The API must not expose AI orchestration endpoints such as `/api/plan-day`, `/api/update-life`, or `/api/brain/*`.

---

# 12. Non-Functional Requirements

## Performance
- CRUD responses should feel instantaneous.
- Page navigation should remain lightweight.

## Reliability
- MongoDB acts as source of truth.

## Maintainability
- Generic controllers reduce duplication.
- Session planning logic belongs in backend services/routes, not React components.

## Extensibility
- External AI services can integrate without modifying the web UI.
- External AI/Codex workflows can call day plan session endpoints and persist results while preserving the frontend as a display and CRUD layer.

## Simplicity
- Keep business logic minimal in frontend.

---

# 13. Security Requirements

Current implementation assumptions:

- Single-user environment.
- Trusted deployment.

Future requirements:

- Authentication
- Authorization
- Encryption of secrets
- Audit logs

---

# 14. Risks

## Schema Drift
AI tools may write inconsistent data.

## Legacy Index Drift
Existing deployments may have a unique `londonDate` index from earlier day planning behavior. The system must relax or remove this uniqueness so multiple sessions can exist on the same London date.

## Lack of Authentication
System unsuitable for public multi-user deployment.

## Manual AI Integration
Requires external workflows.

## Scaling Risks
Current architecture is optimized for personal use.

---

# 15. Future Roadmap

## Phase 1
Current CRUD system.

## Phase 2
Authentication.

## Phase 3
AI orchestration layer.

## Phase 4
Semantic search.

## Phase 5
Knowledge graph.

## Phase 6
Automation engine.

---

# 16. Success Metrics

- Daily active usage
- Tasks completed
- Deliverables shipped
- Reviews created
- Consistent day planning
- Successful session starts and restarts
- Fewer duplicated or reintroduced completed tasks
- Reduced information fragmentation

---

# 17. Definition of Done

The product succeeds when a user can:

1. Capture information.
2. Plan work.
3. Execute tasks.
4. Track deliverables.
5. Reflect on outcomes.
6. Enable external AI systems to reason over structured personal data.

---

# Appendix A – Repository Structure

- client/
- server/
- archive/
- markdown seed files
- tests
- environment configuration

---

# Appendix B – Source of Truth Statement

The current implementation intentionally separates:

**Data Layer**
→ MongoDB

**Interface Layer**
→ React

**Reasoning Layer**
→ External AI/Codex tooling

This separation is a core architectural decision and should be preserved unless an intentional redesign is approved.
